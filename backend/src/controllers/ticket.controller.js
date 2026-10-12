const db = require('../config/db');
const ticketModel = require('../models/ticket.model');
const clientModel = require('../models/client.model');
const batteryModel = require('../models/battery.model');
const realtime = require('../realtime');

function isClientRole(role) {
  return role === 'client' || role === 'recycle_client';
}

async function list(req, res, next) {
  try {
    const { status, category, search, limit = 50, offset = 0, clientId } = req.query;
    let targetClientId = clientId ? Number(clientId) : null;
    let targetClientName = null;

    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      targetClientId = client.id;
      targetClientName = client.name;
    }

    const tickets = await ticketModel.findTickets({
      clientId: targetClientId,
      clientName: targetClientName,
      status,
      category,
      search,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json({ data: tickets });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    let clientId = null;
    let clientName = null;

    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      // Without a linked client record there's nothing to scope to — reject
      // rather than fall through to an unscoped (all clients) lookup.
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      clientId = client.id;
      clientName = client.name;
    }

    const ticket = await ticketModel.findById(id, { clientId, clientName });
    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { subject, category, priority, batteryCode, initialMessage, clientId, clientName } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required.' });
    }
    if (!initialMessage || !initialMessage.trim()) {
      return res.status(400).json({ message: 'Please provide a message description.' });
    }

    let finalClientId = clientId || null;
    let finalClientName = clientName || null;

    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      finalClientId = client.id;
      finalClientName = client.name;
    } else if (!finalClientName) {
      if (finalClientId) {
        const client = await clientModel.findById(finalClientId);
        finalClientName = client ? client.name : 'Client';
      } else {
        finalClientName = 'General Inquiry';
      }
    }

    // A linked battery must exist and, for a client, be one of theirs
    const code = typeof batteryCode === 'string' ? batteryCode.trim().toUpperCase() : '';
    if (code) {
      const battery = await batteryModel.findByCode(code);
      let owned = Boolean(battery);
      if (battery && req.user.role === 'client') {
        owned = String(battery.client_name || '').trim().toLowerCase() === String(finalClientName || '').trim().toLowerCase();
      } else if (battery && req.user.role === 'recycle_client') {
        // a recycling partner can link a battery it received in a shipment
        const { rows } = await db.query(
          `SELECT 1 FROM recycle_batteries rbt
             JOIN recycle_batches rb ON rb.id = rbt.recycle_id
            WHERE rbt.battery_id = $1 AND rb.recycle_client_id = $2 LIMIT 1`,
          [battery.id, finalClientId]
        );
        owned = rows.length > 0;
      }
      if (!owned) {
        const where = req.user.role === 'recycle_client' ? 'your recycle shipments' : 'your fleet';
        return res.status(400).json({ message: `Battery ${code} was not found in ${where}.` });
      }
    }

    const ticket = await ticketModel.createTicket({
      clientId: finalClientId,
      clientName: finalClientName,
      userId: req.user.id,
      subject,
      category: category || 'general',
      priority: priority || 'normal',
      batteryCode: code || null,
      initialMessage,
      senderName: req.user.name || finalClientName,
      senderRole: req.user.role,
    });

    realtime.broadcastTicketCreated(ticket);

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
}

async function addMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    let clientId = null;
    let clientName = null;
    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      // Without a linked client record there's nothing to scope to — reject
      // rather than fall through to an unscoped (all clients) lookup.
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      clientId = client.id;
      clientName = client.name;
    }

    const ticket = await ticketModel.findById(id, { clientId, clientName });
    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    const result = await ticketModel.addMessage({
      ticketId: ticket.id,
      senderId: req.user.id,
      senderName: req.user.name || (isClientRole(req.user.role) ? ticket.client_name : 'Support Agent'),
      senderRole: req.user.role,
      message,
    });

    realtime.broadcastTicketMessage({
      ticketId: ticket.id,
      message: result.message,
      ticket: result.ticket,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    let clientId = null;
    let clientName = null;
    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      // Without a linked client record there's nothing to scope to — reject
      // rather than fall through to an unscoped (all clients) lookup.
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      clientId = client.id;
      clientName = client.name;
    }

    const ticket = await ticketModel.findById(id, { clientId, clientName });
    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    const updated = await ticketModel.updateStatus(ticket.id, status);
    realtime.broadcastTicketStatus(updated);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    let clientId = null;
    let clientName = null;

    if (isClientRole(req.user.role)) {
      const client = await clientModel.findByUserId(req.user.id);
      // Without a linked client record there's nothing to scope to — reject
      // rather than fall through to an unscoped (all clients) lookup.
      if (!client) {
        return res.status(409).json({ message: 'Account is not linked to a client record.' });
      }
      clientId = client.id;
      clientName = client.name;
    }

    const stats = await ticketModel.getStats({ clientId, clientName });
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  addMessage,
  updateStatus,
  getStats,
};
