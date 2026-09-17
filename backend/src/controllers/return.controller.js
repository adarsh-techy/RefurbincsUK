const returnModel = require('../models/return.model');
const clientModel = require('../models/client.model');
const auditLogModel = require('../models/audit-log.model');

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

async function create(req, res, next) {
  try {
    const { truckNumber, driverName, clientId, batteryIds } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client is required.' });
    }
    const returnRecord = await returnModel.create({ truckNumber, driverName, clientId, batteryIds });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'return',
      entityId: returnRecord.id,
      details: { truckNumber, driverName, clientId, batteryIds },
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
    const returnRecord = await returnModel.update(req.params.id, { truckNumber, driverName, clientId });
    if (!returnRecord) {
      return res.status(404).json({ message: 'Return not found' });
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
