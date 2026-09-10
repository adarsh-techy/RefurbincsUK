const recycleModel = require('../models/recycle.model');
const auditLogModel = require('../models/audit-log.model');
const clientModel = require('../models/client.model');
const realtime = require('../realtime');

// Admin sees all batches; a recycle_client sees only their own.
async function list(req, res, next) {
  try {
    let recycleClientId = null;
    if (req.user.role === 'recycle_client') {
      const client = await clientModel.findByUserId(req.user.id);
      recycleClientId = client?.id || -1;
    }
    res.json(await recycleModel.findAll(recycleClientId ? { recycleClientId } : undefined));
  } catch (err) {
    next(err);
  }
}

// Recycle detail page: which batteries went out on this shipment, and why
// each one was declared unserviceable in the first place.
async function getById(req, res, next) {
  try {
    const batch = await recycleModel.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: 'Recycle batch not found' });
    }
    if (req.user.role === 'recycle_client') {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client || batch.recycle_client_id !== client.id) {
        return res.status(403).json({ message: 'Access denied to this shipment' });
      }
    }
    const batteries = await recycleModel.findBatteries(req.params.id);
    res.json({ batch, batteries });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { vehicleNumber, driverName, batteryIds, recycleClientId } = req.body;
    const cleanBatteryIds = Array.isArray(batteryIds)
      ? [...new Set(batteryIds.map(Number).filter(Boolean))]
      : [];
    if (cleanBatteryIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one battery.' });
    }
    const batch = await recycleModel.create({
      vehicleNumber,
      driverName,
      batteryIds: cleanBatteryIds,
      recycleClientId: recycleClientId ? Number(recycleClientId) : null,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'recycle_batch',
      entityId: batch.id,
      details: { vehicleNumber, driverName, batteryIds: cleanBatteryIds },
    });

    // These batteries just left 'unserviceable' — keep the popup alert and
    // the Unserviceable list's live count in sync.
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { vehicleNumber, driverName } = req.body;
    const batch = await recycleModel.update(req.params.id, { vehicleNumber, driverName });
    if (!batch) {
      return res.status(404).json({ message: 'Recycle batch not found' });
    }
    res.json(batch);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await recycleModel.remove(req.params.id);
    await auditLogModel.record({
      userId: req.user.id,
      action: 'delete',
      entity: 'recycle_batch',
      entityId: Number(req.params.id),
    });
    // Undoing a shipment puts these batteries back to 'unserviceable'.
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
