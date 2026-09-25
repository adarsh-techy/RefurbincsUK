const fs = require('fs');
const path = require('path');
const returnModel = require('../models/return.model');
const clientModel = require('../models/client.model');
const auditLogModel = require('../models/audit-log.model');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'return-docs');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// GET /:id and PATCH /:id/verify-receipt are reachable by any authenticated
// role (not just requirePermission('returns') staff) so a client can view
// or verify receipt of their own return shipment. This resolves who's
// asking and what they're allowed to touch:
//   - staff/admin with the 'returns' permission (or super_admin): any record
//   - a client: only a return whose client_id is their own
//   - anyone else: nothing
// Returns the matched client row when the caller is a client, or `true` for
// staff, or `null` if the caller isn't authorized for this record at all.
async function resolveReturnAccess(req, returnRecord) {
  if (req.user.role === 'super_admin' || (req.user.permissions || []).includes('returns')) {
    return true;
  }
  if (req.user.role === 'client') {
    const client = await clientModel.findByUserId(req.user.id);
    if (client && returnRecord.client_id === client.id) {
      return true;
    }
  }
  return false;
}

async function list(req, res, next) {
  try {
    res.json(await returnModel.findAll());
  } catch (err) {
    next(err);
  }
}

// Return detail page: which batteries went out on this shipment, and what
// service each one had just before shipping.
async function getById(req, res, next) {
  try {
    const returnRecord = await returnModel.findById(req.params.id);
    if (!returnRecord) {
      return res.status(404).json({ message: 'Return not found' });
    }
    if (!(await resolveReturnAccess(req, returnRecord))) {
      return res.status(403).json({ message: 'Not authorized for this return dispatch.' });
    }
    const batteries = await returnModel.findBatteries(req.params.id);
    res.json({ returnRecord, batteries });
  } catch (err) {
    next(err);
  }
}

// Writes an uploaded delivery note/receipt to uploads/return-docs and returns
// the public path + original name. Shared by create() and update(); async so
// a 15MB PDF doesn't stall the event loop for every other request.
async function persistReturnDoc(file) {
  ensureUploadsDir();
  const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `return-${Date.now()}-${cleanOriginal}`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return { documentUrl: `/uploads/return-docs/${filename}`, documentName: file.originalname };
}

// Removes a previously stored return document (best effort — a missing file
// is not an error). Only ever touches files inside UPLOADS_DIR.
async function removeReturnDoc(documentUrl) {
  if (!documentUrl) return;
  const filename = path.basename(documentUrl);
  try {
    await fs.promises.unlink(path.join(UPLOADS_DIR, filename));
  } catch (_) {}
}

// returned_at comes from a date picker; anything unparseable must be a 400,
// not a 500 from `new Date(garbage)` inside the model.
function parseReturnedAt(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    const err = new Error('Invalid return date.');
    err.status = 400;
    throw err;
  }
  return new Date(ts).toISOString();
}

async function create(req, res, next) {
  try {
    let { truckNumber, driverName, clientId, batteryIds, returnedAt } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client is required.' });
    }

    if (typeof batteryIds === 'string') {
      try {
        batteryIds = JSON.parse(batteryIds);
      } catch (e) {
        batteryIds = batteryIds.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    returnedAt = parseReturnedAt(returnedAt);

    let documentUrl = undefined;
    let documentName = undefined;
    if (req.file) {
      ({ documentUrl, documentName } = await persistReturnDoc(req.file));
    }

    const returnRecord = await returnModel.create({
      truckNumber,
      driverName,
      clientId,
      batteryIds: Array.isArray(batteryIds) ? batteryIds : [],
      returnedAt,
      documentUrl,
      documentName,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'return',
      entityId: returnRecord.id,
      details: { truckNumber, driverName, clientId, batteryIds, returnedAt, documentUrl },
    });

    res.status(201).json(returnRecord);
  } catch (err) {
    next(err);
  }
}

async function verifyReceipt(req, res, next) {
  try {
    const returnRecord = await returnModel.findById(req.params.id);
    if (!returnRecord) {
      return res.status(404).json({ message: 'Return not found.' });
    }
    if (!(await resolveReturnAccess(req, returnRecord))) {
      return res.status(403).json({ message: 'Not authorized for this return dispatch.' });
    }
    const updated = await returnModel.verifyReceipt(req.params.id, req.user.id);
    await auditLogModel.record({
      userId: req.user.id,
      action: 'verify_return_receipt',
      entity: 'return',
      entityId: updated.id,
      details: { truckNumber: updated.truck_number, driverName: updated.driver_name },
    });
    res.json({
      message: `Return shipment ${updated.truck_number} verified and received successfully.`,
      returnRecord: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { truckNumber, driverName, clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client is required.' });
    }
    const returnedAt = parseReturnedAt(req.body.returnedAt);

    const existing = await returnModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Return not found' });
    }

    let documentUrl = undefined;
    let documentName = undefined;
    if (req.file) {
      ({ documentUrl, documentName } = await persistReturnDoc(req.file));
    }

    const returnRecord = await returnModel.update(req.params.id, {
      truckNumber,
      driverName,
      clientId,
      returnedAt,
      documentUrl,
      documentName,
    });
    if (!returnRecord) {
      return res.status(404).json({ message: 'Return not found' });
    }
    // The old file is orphaned once a replacement is stored — drop it so the
    // uploads directory doesn't grow with every edit.
    if (documentUrl && existing.document_url && existing.document_url !== documentUrl) {
      await removeReturnDoc(existing.document_url);
    }
    res.json(returnRecord);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await returnModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, verifyReceipt, update, remove };
