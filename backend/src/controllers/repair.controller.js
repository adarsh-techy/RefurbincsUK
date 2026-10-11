const crypto = require('crypto');
const repairModel = require('../models/repair.model');
const auditLogModel = require('../models/audit-log.model');
const staffModel = require('../models/staff.model');
const realtime = require('../realtime');

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Escapes ILIKE wildcard characters so a literal "%" or "_" typed by the
// user is matched literally instead of acting as a SQL wildcard.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function list(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const date = DATE_PATTERN.test(req.query.date) ? req.query.date : undefined;
    // web sends ?q=, the mobile list screens send ?search=
    const rawQ = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q : req.query.search;
    const q =
      typeof rawQ === 'string' && rawQ.trim()
        ? escapeLike(rawQ.trim().slice(0, 50))
        : undefined;

    const { rows, hasMore } = await repairModel.findPage({ limit, offset, date, q });
    res.json({ data: rows, hasMore });
  } catch (err) {
    next(err);
  }
}

// Every repair is always exactly one unit of one part — quantity isn't a
// client input, it's fixed here so it can never drift from that rule.
const FIXED_QUANTITY = 1;

async function create(req, res, next) {
  try {
    const { batteryId, partId, notes } = req.body;
    let staffId = req.body.staffId;
    // A technician can only ever log work under their own linked staff
    // record — never a client-supplied one — so it's resolved server-side
    // from the logged-in account instead of trusted from the request body.
    if (req.user.role === 'technician') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (!staff) {
        return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
      }
      staffId = staff.id;
    }
    const laborCharge = Math.max(Number(req.body.laborCharge) || 0, 0);
    // Every part logged in the same Log Repair submission shares a batchId
    // (generated client-side) so the list page can show them as one row.
    // Falls back to a fresh id if a caller doesn't supply one.
    const batchId =
      typeof req.body.batchId === 'string' && req.body.batchId.trim()
        ? req.body.batchId.trim().slice(0, 40)
        : crypto.randomUUID();
    const repair = await repairModel.create({
      batteryId,
      staffId,
      partId,
      quantityUsed: FIXED_QUANTITY,
      notes,
      laborCharge,
      batchId,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'repair',
      entityId: repair.id,
      details: { batteryId, staffId, partId, laborCharge },
    });

    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(201).json(repair);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const repair = await repairModel.update(req.params.id, {
      quantityUsed: FIXED_QUANTITY,
      notes: req.body.notes || null,
    });
    if (!repair) {
      return res.status(404).json({ message: 'Repair not found' });
    }
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.json(repair);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await repairModel.remove(req.params.id);
    realtime.broadcastOutOfStockParts().catch((err) => console.error('broadcastOutOfStockParts:', err));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
