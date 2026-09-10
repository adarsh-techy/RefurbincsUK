const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const clientModel = require('../models/client.model');
const invoiceModel = require('../models/invoice.model');

// A client's own logo — uploaded here by an admin, shown back on that
// client's own dashboard. Stored on disk the same way invoice PDFs are
// (see invoice.controller.js), just the generated filename kept in the DB.
const LOGO_UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'client-logos');
if (!fs.existsSync(LOGO_UPLOADS_DIR)) {
  fs.mkdirSync(LOGO_UPLOADS_DIR, { recursive: true });
}

function saveLogoFile(file) {
  const safeName = `logo-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  fs.writeFileSync(path.join(LOGO_UPLOADS_DIR, safeName), file.buffer);
  return safeName;
}

function deleteLogoFile(fileName) {
  if (!fileName) return;
  const fullPath = path.join(LOGO_UPLOADS_DIR, fileName);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // non-fatal — an orphaned file on disk isn't worth failing the request over
    }
  }
}

async function list(req, res, next) {
  try {
    res.json(await clientModel.findAll());
  } catch (err) {
    next(err);
  }
}

// Admin-facing client detail page: profile, battery/status stats, and
// billing history — same data as the client's own "myDashboard"/
// "myTransactions" but looked up by id directly instead of the caller's
// own linked login.
async function getById(req, res, next) {
  try {
    const client = await clientModel.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    const [stats, transactions] = await Promise.all([
      clientModel.getDashboardStats(client.id, client.name),
      clientModel.findMyTransactions(client.id, client.name),
    ]);
    res.json({ client, stats, transactions });
  } catch (err) {
    next(err);
  }
}

// email/tempPassword are optional — supplying both also grants this client
// a login account (role 'client'), which must set its own password on
// first login (see must_change_password) and respects granted permissions.
async function create(req, res, next) {
  try {
    const { name, invoiceEmail, invoice_email, email, tempPassword, role, permissions } = req.body;
    let parsedPermissions = [];
    if (permissions) {
      try {
        parsedPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
      } catch {
        parsedPermissions = Array.isArray(permissions) ? permissions : [];
      }
    }
    const passwordHash = email && tempPassword ? await bcrypt.hash(tempPassword, 10) : undefined;
    const logoPath = req.file ? saveLogoFile(req.file) : undefined;
    const client = await clientModel.create({
      name,
      invoiceEmail: invoiceEmail || invoice_email,
      email,
      passwordHash,
      role,
      permissions: parsedPermissions,
      logoPath,
    });
    res.status(201).json(client);
  } catch (err) {
    // Unique violation: a client with this name already exists, or the
    // email is already used by another login account.
    if (err.code === '23505') {
      return res.status(409).json({
        message: err.constraint === 'users_email_key'
          ? 'An account with that email already exists.'
          : 'A client with this name already exists.',
      });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, invoiceEmail, invoice_email, email, tempPassword, permissions, active } = req.body;
    let parsedPermissions = undefined;
    if (permissions !== undefined) {
      try {
        parsedPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
      } catch {
        parsedPermissions = Array.isArray(permissions) ? permissions : [];
      }
    }
    const passwordHash = tempPassword ? await bcrypt.hash(tempPassword, 10) : undefined;
    let logoPath;
    let previousLogoPath;
    if (req.file) {
      const existing = await clientModel.findById(req.params.id);
      previousLogoPath = existing?.logo_path;
      logoPath = saveLogoFile(req.file);
    }
    const client = await clientModel.update(req.params.id, {
      name,
      invoiceEmail: invoiceEmail !== undefined ? invoiceEmail : invoice_email,
      logoPath,
      email,
      passwordHash,
      permissions: parsedPermissions,
      active,
    });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    if (previousLogoPath && previousLogoPath !== logoPath) {
      deleteLogoFile(previousLogoPath);
    }
    res.json(client);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: err.constraint === 'users_email_key'
          ? 'An account with that email already exists.'
          : 'A client with this name already exists.',
      });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await clientModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    // FK violation: this client is tagged on a truck intake.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete a client tagged on an existing truck intake.',
      });
    }
    next(err);
  }
}

// The logged-in client's own dashboard — resolves their `clients` row from
// the linked login account rather than trusting any id from the request.
async function myDashboard(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const stats = await clientModel.getDashboardStats(client.id, client.name);
    res.json({ client, stats });
  } catch (err) {
    next(err);
  }
}

const VALID_BUCKETS = new Set(['packed', 'pending', 'received']);

// One of the client dashboard's 3 battery lists: ?bucket=packed|pending|received.
async function myBatteries(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const bucket = VALID_BUCKETS.has(req.query.bucket) ? req.query.bucket : req.query.bucket === 'all' ? 'all' : undefined;
    const data = await clientModel.findMyBatteries(client.id, client.name, bucket);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// The client's own billing history — every repair charge across every
// battery they've sent in.
async function myTransactions(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const data = await clientModel.findMyTransactions(client.id, client.name);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// The client's own notification feed — battery intakes, repair logs, and return dispatches
async function myNotifications(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const type = req.query.type;
    const data = await clientModel.findMyNotifications(client.id, client.name, { limit, offset, type });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// Client packing a battery to send to workshop for repair (via QR scan or manual code entry)
async function packBatteryForRepair(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const { batteryCode, serialNumber, truckNumber, driverName, issueDescription, batteries } = req.body;
    if (!batteryCode && (!batteries || batteries.length === 0)) {
      return res.status(400).json({ message: 'At least one battery code is required.' });
    }
    const result = await clientModel.packBatteryForRepair(client.id, client.name, {
      batteryCode,
      serialNumber,
      truckNumber,
      driverName,
      issueDescription,
      batteries,
    });
    res.status(201).json({
      message: 'Batteries packed and recorded for repair intake successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// The client's complete lifecycle activity history and summary
async function myHistory(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const { type, search } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Number(req.query.offset) || 0;

    const [events, summary] = await Promise.all([
      clientModel.findMyHistory(client.id, client.name, { type, search, limit, offset }),
      clientModel.getHistorySummary(client.id, client.name),
    ]);

    res.json({
      client,
      summary,
      events,
    });
  } catch (err) {
    next(err);
  }
}

// The client's own invoices (with download link)
async function myInvoices(req, res, next) {
  try {
    const client = await clientModel.findByUserId(req.user.id);
    if (!client) {
      return res.status(409).json({ message: 'Your account is not linked to a client record.' });
    }
    const data = await invoiceModel.findByClientId(client.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  myDashboard,
  myBatteries,
  myTransactions,
  myNotifications,
  myHistory,
  packBatteryForRepair,
  myInvoices,
};
