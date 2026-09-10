const truckIntakeModel = require('../models/truck-intake.model');
const batteryModel = require('../models/battery.model');
const auditLogModel = require('../models/audit-log.model');
const truckIntakeService = require('../services/truck-intake.service');
const { parseTruckIntakeSheet } = require('../utils/parse-truck-intake-sheet');
const realtime = require('../realtime');

async function list(req, res, next) {
  try {
    res.json(await truckIntakeModel.findAll());
  } catch (err) {
    next(err);
  }
}

// Intake detail page: the intake itself plus every battery it generated, so
// clicking a truck shows exactly which batteries came off it.
async function getById(req, res, next) {
  try {
    const intake = await truckIntakeModel.findById(req.params.id);
    if (!intake) {
      return res.status(404).json({ message: 'Truck intake not found' });
    }
    const batteries = await batteryModel.findByTruckIntakeId(req.params.id);
    res.json({ intake, batteries });
  } catch (err) {
    next(err);
  }
}

// Creates the intake record and generates a unique battery_code
// for each battery delivered, per the spec's tracking requirement.
async function create(req, res, next) {
  try {
    const { truckNumber, driverName, batteryCount, clientId, scannedBatteryIds } = req.body;
    if (!clientId) {
      return res.status(400).json({ message: 'Client is required.' });
    }
    const cleanScannedIds = Array.isArray(scannedBatteryIds)
      ? [...new Set(scannedBatteryIds.map(Number).filter(Boolean))]
      : [];
    const { intake, batteries } = await truckIntakeService.createIntakeWithBatteries({
      truckNumber,
      driverName,
      batteryCount: Number(batteryCount) || 0,
      clientId: clientId ? Number(clientId) : null,
      scannedBatteryIds: cleanScannedIds,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'truck_intake',
      entityId: intake.id,
      details: { truckNumber, driverName, batteryCount, clientId, scannedCount: cleanScannedIds.length },
    });

    realtime.broadcastRepeatIntakes().catch((err) => console.error('broadcastRepeatIntakes:', err));
    res.status(201).json({ intake, batteries });
  } catch (err) {
    next(err);
  }
}

// Bulk import from an uploaded .xlsx/.csv (e.g. exported from Excel or from
// a Google Form's linked response sheet). Valid rows are created one intake
// at a time; invalid rows are reported back without stopping the whole import.
async function importSheet(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let rows;
    try {
      rows = await parseTruckIntakeSheet(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }

    const created = [];
    const failed = [];

    for (const row of rows) {
      if (row.error) {
        failed.push({ rowNumber: row.rowNumber, message: row.error });
        continue;
      }

      try {
        const { intake } = await truckIntakeService.createIntakeWithBatteries({
          truckNumber: row.truckNumber,
          driverName: row.driverName,
          batteryCount: row.batteryCount,
        });
        created.push(intake);
      } catch (rowErr) {
        failed.push({ rowNumber: row.rowNumber, message: rowErr.message });
      }
    }

    await auditLogModel.record({
      userId: req.user.id,
      action: 'import',
      entity: 'truck_intake',
      details: { fileName: req.file.originalname, created: created.length, failed: failed.length },
    });

    if (created.length > 0) {
      realtime.broadcastRepeatIntakes().catch((err) => console.error('broadcastRepeatIntakes:', err));
    }
    res.status(201).json({ created, failed });
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
    const intake = await truckIntakeModel.update(req.params.id, {
      truckNumber,
      driverName,
      clientId: clientId ? Number(clientId) : null,
    });
    if (!intake) {
      return res.status(404).json({ message: 'Truck intake not found' });
    }

    await auditLogModel.record({
      userId: req.user.id,
      action: 'update',
      entity: 'truck_intake',
      entityId: intake.id,
      details: { truckNumber, driverName, clientId },
    });

    res.json(intake);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await truckIntakeModel.remove(req.params.id);
    await auditLogModel.record({
      userId: req.user.id,
      action: 'delete',
      entity: 'truck_intake',
      entityId: Number(req.params.id),
    });
    res.status(204).end();
  } catch (err) {
    // FK violation: batteries were generated from this intake.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete an intake that already has batteries recorded against it.',
      });
    }
    next(err);
  }
}

async function verifyArrival(req, res, next) {
  try {
    const intake = await truckIntakeModel.verifyArrival(req.params.id, req.user.id);
    if (!intake) {
      return res.status(404).json({ message: 'Truck intake not found.' });
    }
    await auditLogModel.record({
      userId: req.user.id,
      action: 'verify_arrival',
      entity: 'truck_intake',
      entityId: intake.id,
      details: { truckNumber: intake.truck_number, driverName: intake.driver_name },
    });
    res.json({ message: `Truck ${intake.truck_number} arrival verified successfully.`, intake });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, importSheet, update, remove, verifyArrival };
