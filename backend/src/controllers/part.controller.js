const db = require('../config/db');
const partModel = require('../models/part.model');
const trashModel = require('../models/trash.model');
const realtime = require('../realtime');

// ?batteryId=… : only the parts a repair on that battery may use — the
// battery's client's parts (plus old unassigned stock). ?clientId=… : one
// client's parts. Neither: every part (the inventory page).
async function list(req, res, next) {
  try {
    if (req.query.batteryId) {
      const client = await partModel.findClientForBattery(Number(req.query.batteryId));
      if (!client) return res.json(await partModel.findAll({ clientId: -1, withUnassigned: true }));
      return res.json(await partModel.findAll({ clientId: client.id, withUnassigned: true }));
    }
    if (req.query.clientId) return res.json(await partModel.findAll({ clientId: Number(req.query.clientId) }));
    res.json(await partModel.findAll());
  } catch (err) {
    next(err);
  }
}

// Fleet clients a part can belong to (id + name) — for the part form's
// client picker, so it works for logins without the Clients module.
async function listPartClients(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.name FROM clients c LEFT JOIN users u ON u.id = c.user_id
        WHERE COALESCE(u.role, 'client') <> 'recycle_client'
          AND NOT EXISTS (SELECT 1 FROM recycle_batches rb WHERE rb.recycle_client_id = c.id)
        ORDER BY c.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// A part must belong to a fleet client (not a recycling partner).
async function checkPartClient(clientId) {
  const id = Number(clientId);
  if (!id) return { status: 400, message: 'Select the client these parts belong to.' };
  const { rows } = await db.query(
    `SELECT c.id, COALESCE(u.role, 'client') AS role FROM clients c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
    [id]
  );
  if (!rows[0]) return { status: 400, message: 'That client no longer exists.' };
  if (rows[0].role === 'recycle_client') return { status: 400, message: 'Parts belong to fleet clients, not recycling partners.' };
  return null;
}

function parseMinStock(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    const err = new Error('Minimum stock must be a whole number of 0 or more.');
    err.status = 400;
    throw err;
  }
  return n;
}

function skuTaken(err, res) {
  if (err.code === '23505') {
    res.status(409).json({ message: 'This client already has a part with that SKU.' });
    return true;
  }
  return false;
}

// Part detail page: the part's own info plus every repair that's used it and
// every manual restock, for the "how often used, how often topped up" view.
async function getById(req, res, next) {
  try {
    const part = await partModel.findById(req.params.id);
    if (!part) {
      return res.status(404).json({ message: 'Part not found' });
    }
    const [usageHistory, stockHistory] = await Promise.all([
      partModel.findUsageHistory(req.params.id),
      partModel.findStockHistory(req.params.id),
    ]);
    res.json({ part, usageHistory, stockHistory });
  } catch (err) {
    next(err);
  }
}

function formatPartName(str) {
  if (!str || typeof str !== 'string') return str;
  const trimmed = str.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

async function create(req, res, next) {
  try {
    const { name, sku, quantity, repairCost, serviceCharge, clientId, minStock } = req.body;
    const bad = await checkPartClient(clientId);
    if (bad) return res.status(bad.status).json({ message: bad.message });
    const part = await partModel.create({
      name: formatPartName(name),
      sku: sku ? sku.trim() : sku,
      quantity: quantity || 0,
      repairCost: repairCost || 0,
      serviceCharge: serviceCharge || 0,
      clientId: Number(clientId),
      minStock: parseMinStock(minStock) ?? 5,
    });
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(201).json(part);
  } catch (err) {
    if (skuTaken(err, res)) return;
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, sku, quantity, repairCost, serviceCharge, clientId, minStock } = req.body;
    if (clientId !== undefined) {
      const bad = await checkPartClient(clientId);
      if (bad) return res.status(bad.status).json({ message: bad.message });
    }
    const part = await partModel.update(req.params.id, {
      name: formatPartName(name),
      sku: sku ? sku.trim() : sku,
      quantity: quantity || 0,
      repairCost: repairCost || 0,
      serviceCharge: serviceCharge || 0,
      clientId: clientId !== undefined ? Number(clientId) : undefined,
      minStock: parseMinStock(minStock),
    });
    if (!part) {
      return res.status(404).json({ message: 'Part not found' });
    }
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.json(part);
  } catch (err) {
    if (skuTaken(err, res)) return;
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const part = await partModel.findById(req.params.id);
    if (!part) {
      return res.status(404).json({ message: 'Part not found' });
    }

    await partModel.remove(req.params.id);

    try {
      await trashModel.record({
        originalId: part.id,
        itemType: 'part',
        title: part.name || `Part #${part.id}`,
        subtitle: `SKU: ${part.sku || 'N/A'} • Cost: £${part.cost || 0} • Stock: ${part.quantity || 0}`,
        itemData: part,
        user: req.user,
      });
    } catch (trashErr) {
      console.error('Error logging part to trash:', trashErr);
    }

    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(204).end();
  } catch (err) {
    // FK violation: this part has been used in a repair.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete a part that has been used in a repair.',
      });
    }
    next(err);
  }
}

// Tops up an out-of-stock (or any) part's quantity and logs who added how
// much, separate from the full edit form so restocking doesn't require
// re-typing the part's name/SKU/cost just to bump the count.
async function restock(req, res, next) {
  try {
    const quantityAdded = Number(req.body.quantityAdded);
    if (!Number.isInteger(quantityAdded) || quantityAdded <= 0) {
      return res.status(400).json({ message: 'quantityAdded must be a positive whole number' });
    }
    const part = await partModel.addStock(req.params.id, {
      quantityAdded,
      note: req.body.note,
      adjustedByUserId: req.user.id,
    });
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.json(part);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
}

module.exports = { list, listPartClients, getById, create, update, remove, restock };
