const batteryModel = require('../models/battery.model');
const staffModel = require('../models/staff.model');
const clientModel = require('../models/client.model');
const recycleModel = require('../models/recycle.model');
const realtime = require('../realtime');

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;
const VALID_STATUSES = new Set([
  'in_repair',
  'in_progress',
  'in_testing',
  'repaired',
  'returned',
  'unserviceable',
  'recycled',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Escapes ILIKE wildcard characters so a literal "%" or "_" typed by the
// user is matched literally instead of acting as a SQL wildcard.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Paginated for infinite scroll: ?limit=15&offset=0 (defaults match the
// Batteries page's 15-per-scroll behavior). ?status= narrows to one state
// (e.g. 'repaired', used by the Returns form to list return-eligible
// batteries). ?date=YYYY-MM-DD narrows to batteries created that day.
// ?q= does a partial battery-code match, for the live lookup typeahead.
// ?search= matches battery code OR client name, for the Generated QR Codes
// list. ?qrGenerated=true restricts that same list to batteries that
// already have a QR code; ?qrGenerated=false excludes them (used by the
// Generate QR Code form's typeahead, so an already-generated battery can't
// be picked again).
async function list(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const status = VALID_STATUSES.has(req.query.status) ? req.query.status : undefined;
    const date = DATE_PATTERN.test(req.query.date) ? req.query.date : undefined;
    const q =
      typeof req.query.q === 'string' && req.query.q.trim()
        ? escapeLike(req.query.q.trim().slice(0, 50))
        : undefined;
    const search =
      typeof req.query.search === 'string' && req.query.search.trim()
        ? escapeLike(req.query.search.trim().slice(0, 50))
        : undefined;
    const clientName =
      typeof req.query.clientName === 'string' && req.query.clientName.trim()
        ? req.query.clientName.trim().slice(0, 100)
        : undefined;
    const qrGenerated =
      req.query.qrGenerated === 'true' ? true : req.query.qrGenerated === 'false' ? false : undefined;
    const includeBlocked = req.query.includeBlocked === 'true';
    const activeOnly = req.query.activeOnly === 'true';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const { rows, hasMore } = await batteryModel.findPage({
      limit,
      offset,
      status,
      date,
      q,
      search,
      clientName,
      qrGenerated,
      includeBlocked,
      activeOnly,
      sortOrder,
    });
    res.json({ data: rows, hasMore });
  } catch (err) {
    next(err);
  }
}

// Look up a battery by its unique code and return its full lifecycle: every
// truck/driver that's ever brought it in, every repair, and every return.
async function getByCode(req, res, next) {
  try {
    const battery = await batteryModel.findByCode(req.params.code);
    if (!battery) {
      return res.status(404).json({ message: 'Battery not found' });
    }
    const [history, returns, visits, issues, recycleBatch] = await Promise.all([
      batteryModel.findRepairHistory(battery.id),
      batteryModel.findReturnHistory(battery.id),
      batteryModel.findVisitHistory(battery.id),
      batteryModel.findIssueHistory(battery.id),
      recycleModel.findByBatteryId(battery.id),
    ]);
    res.json({ battery, history, returns, visits, issues, recycleBatch });
  } catch (err) {
    next(err);
  }
}

// Manual status correction. Battery code and truck intake stay fixed.
async function update(req, res, next) {
  try {
    if (!VALID_STATUSES.has(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const battery = await batteryModel.updateStatus(req.params.id, req.body.status);
    if (!battery) {
      return res.status(404).json({ message: 'Battery not found' });
    }
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await batteryModel.remove(req.params.id);
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    res.status(204).end();
  } catch (err) {
    // FK violation: this battery has repair or return history.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete a battery that has repair or return history.',
      });
    }
    next(err);
  }
}

// Assigns/updates the client a battery belongs to and marks its QR code as
// generated — used by the Generate QR Code page. Separate from `update`
// (status correction) so it isn't locked to super_admin. A battery can only
// get one QR code, ever: if it already has one, this rejects with 409.
// Optional batteryCode renames the battery to a client-prefixed ID (e.g.
// "UBE-0001") at the same time — that's the code the QR ends up encoding.
async function updateClient(req, res, next) {
  try {
    const clientName = typeof req.body.clientName === 'string' ? req.body.clientName.trim() : '';
    const batteryCode = typeof req.body.batteryCode === 'string' ? req.body.batteryCode.trim() : '';
    const battery = await batteryModel.updateClientName(
      req.params.id,
      clientName || null,
      batteryCode || undefined
    );
    if (!battery) {
      const existing = await batteryModel.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Battery not found' });
      }
      return res.status(409).json({ message: 'A QR code has already been generated for this battery.' });
    }
    res.json(battery);
  } catch (err) {
    // Unique violation: another battery already has this code.
    if (err.code === '23505') {
      return res.status(409).json({
        message: 'That battery ID is already in use — try a different battery number.',
      });
    }
    next(err);
  }
}

// Next available battery number for a client (e.g. Uber's 6th battery ->
// { count: 5 }, so the form suggests 6) — for the Generate QR Code form's
// auto-suggested Battery Number field.
async function countByClient(req, res, next) {
  try {
    const clientName = typeof req.query.clientName === 'string' ? req.query.clientName.trim() : '';
    if (!clientName) {
      return res.json({ lastNumber: 0 });
    }
    const lastNumber = await batteryModel.maxSequenceByClientName(clientName);
    res.json({ lastNumber });
  } catch (err) {
    next(err);
  }
}

// Registers a battery straight from the Generate QR Code page: client and
// the computed client-prefixed battery ID are required (the ID is what the
// QR ends up encoding); serialNumber (the manufacturer's own serial) is
// optional, kept for reference only.
async function generate(req, res, next) {
  try {
    const clientName = typeof req.body.clientName === 'string' ? req.body.clientName.trim() : '';
    const batteryCode = typeof req.body.batteryCode === 'string' ? req.body.batteryCode.trim() : '';
    const serialNumber = typeof req.body.serialNumber === 'string' ? req.body.serialNumber.trim() : '';
    if (!clientName) {
      return res.status(400).json({ message: 'Select a client first.' });
    }
    if (!batteryCode) {
      return res.status(400).json({ message: 'Battery ID could not be generated.' });
    }
    const battery = await batteryModel.createForClient({
      batteryCode,
      serialNumber,
      clientName,
      addedByRole: req.user?.role || 'admin',
    });
    res.status(201).json(battery);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'batteries_client_serial_unique') {
        return res.status(409).json({
          message: 'This client already has a battery registered with that number.',
        });
      }
      return res.status(409).json({ message: 'That battery ID is already in use — try again.' });
    }
    next(err);
  }
}

// Bulk creates up to 50,000 QR codes for a client in one batch.
async function generateBulk(req, res, next) {
  try {
    const clientName = typeof req.body.clientName === 'string' ? req.body.clientName.trim() : '';
    const count = parseInt(req.body.count, 10);
    const startNumber = req.body.startNumber ? parseInt(req.body.startNumber, 10) : undefined;

    if (!clientName) {
      return res.status(400).json({ message: 'Select a client first.' });
    }
    if (isNaN(count) || count < 1 || count > 50000) {
      return res.status(400).json({ message: 'Please enter a count between 1 and 50,000.' });
    }

    const result = await batteryModel.createManyForClient({
      clientName,
      count,
      startNumber,
    });

    res.status(201).json({
      message: `Successfully generated ${result.count.toLocaleString()} QR codes for ${clientName}.`,
      ...result,
      clientName,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: 'Some battery IDs in this range already exist. Please adjust the starting number.',
      });
    }
    next(err);
  }
}

// Updates or adds the physical Battery Number (manufacturer serial).
// If a client sets the battery number, admins cannot overwrite it ("if client add then not add admin").
async function updateSerialNumber(req, res, next) {
  try {
    const batteryId = req.params.id;
    const serialNumber = typeof req.body.serialNumber === 'string' ? req.body.serialNumber.trim() : '';
    const existing = await batteryModel.findById(batteryId);

    if (!existing) {
      return res.status(404).json({ message: 'Battery not found.' });
    }

    let addedByRole = req.user?.role || 'admin';

    if (req.user?.role === 'client') {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client) {
        return res.status(403).json({ message: 'Your account is not linked to a client record.' });
      }
      const batteryClient = (existing.client_name || '').toLowerCase();
      const userClient = (client.name || '').toLowerCase();
      if (batteryClient && userClient && batteryClient !== userClient) {
        return res.status(403).json({ message: 'You can only edit batteries belonging to your company.' });
      }
      // A client can set the Battery Number once, while it's still blank,
      // but can't come back and edit it afterwards — that's an admin-only
      // action now (with a type-to-confirm gate on the frontend), so a
      // client can't quietly overwrite a number that's already on file,
      // whoever set it.
      if (existing.serial_number) {
        return res.status(403).json({
          message: 'This battery already has a Battery Number on file. Contact your workshop to change it.',
        });
      }
      addedByRole = 'client';
    }
    // Admin / super_admin may set or override the Battery Number at any
    // time, including one a client set — the frontend gates that override
    // behind typing a confirmation word rather than blocking it here.

    const updated = await batteryModel.updateSerialNumber(batteryId, {
      serialNumber,
      addedByRole,
    });

    realtime.broadcastBatteryUpdated(updated);
    res.json(updated);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'batteries_client_serial_unique') {
        return res.status(409).json({
          message: 'This client already has a battery registered with that number.',
        });
      }
    }
    next(err);
  }
}

// Distinct serial numbers already on file, for the Battery Number field's
// "enter or select" autocomplete.
async function listSerialNumbers(req, res, next) {
  try {
    res.json(await batteryModel.listSerialNumbers());
  } catch (err) {
    next(err);
  }
}

// Powers the navbar's repeat-intake alert icon.
async function repeatIntakesThisMonth(req, res, next) {
  try {
    res.json(await batteryModel.findRepeatIntakesThisMonth());
  } catch (err) {
    next(err);
  }
}

// Powers the Unserviceable Batteries page's 100-battery popup alert.
async function unserviceableCount(req, res, next) {
  try {
    res.json({ count: await batteryModel.countByStatus('unserviceable') });
  } catch (err) {
    next(err);
  }
}

// A technician claiming a battery to start work on, before logging any part.
async function startWork(req, res, next) {
  try {
    const battery = await batteryModel.startWork(req.params.id, req.user.id);
    if (!battery) {
      return res.status(409).json({
        message: 'This battery cannot be started — it may already be in progress or completed.',
      });
    }
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    next(err);
  }
}

// Confirms a battery works after its parts were replaced — restricted to
// Supervisors, Managers, and Admins (Technicians do not have testing permission).
async function completeTesting(req, res, next) {
  try {
    if (req.user.role === 'technician') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (!staff) {
        return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
      }
      const staffRole = (staff.role || '').toLowerCase();
      if (staffRole === 'technician') {
        return res.status(403).json({
          message:
            'Technicians do not have permission to perform testing. Only Supervisors and Managers can complete testing.',
        });
      }
    }

    const battery = await batteryModel.completeTesting(req.params.id);
    if (!battery) {
      return res.status(409).json({
        message: 'This battery cannot be marked completed — it may not be in testing.',
      });
    }
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    next(err);
  }
}

// A technician reporting that a battery in progress can't be serviced (e.g.
// it's dead) — records who reported it, why (an admin-managed reason), and
// an optional free-text note, then moves the battery to 'unserviceable'.
async function reportIssue(req, res, next) {
  try {
    const reasonId = Number(req.body.reasonId);
    if (!reasonId) {
      return res.status(400).json({ message: 'Select a reason' });
    }
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';

    // Route is technician-only (see battery.routes.js), so this always
    // resolves — same pattern as repair.controller.js's staffId lookup.
    const staff = await staffModel.findByUserId(req.user.id);
    if (!staff) {
      return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
    }

    const battery = await batteryModel.reportIssue(req.params.id, {
      staffId: staff.id,
      reasonId,
      note,
    });
    if (!battery) {
      return res.status(409).json({
        message: 'This battery cannot be reported — work must be in progress first.',
      });
    }
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    // FK violation: the reason id doesn't exist.
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Invalid reason selected' });
    }
    next(err);
  }
}

// Hides/restores a battery app-wide (Batteries list, Generate QR Code list,
// typeahead suggestions) without touching its history. Super_admin only,
// same as delete/status correction.
async function setBlocked(req, res, next) {
  try {
    const battery = await batteryModel.setBlocked(req.params.id, req.body.blocked === true);
    if (!battery) {
      return res.status(404).json({ message: 'Battery not found' });
    }
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getByCode,
  update,
  updateClient,
  countByClient,
  generate,
  generateBulk,
  updateSerialNumber,
  listSerialNumbers,
  repeatIntakesThisMonth,
  unserviceableCount,
  startWork,
  completeTesting,
  reportIssue,
  remove,
  setBlocked,
};
