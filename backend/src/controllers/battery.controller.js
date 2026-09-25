const fs = require('fs');
const path = require('path');
const batteryModel = require('../models/battery.model');
const staffModel = require('../models/staff.model');
const clientModel = require('../models/client.model');
const recycleModel = require('../models/recycle.model');
const serviceModel = require('../models/service.model');
const trashModel = require('../models/trash.model');
const truckIntakeModel = require('../models/truck-intake.model');
const realtime = require('../realtime');

const ISSUE_PHOTOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'issue-photos');
if (!fs.existsSync(ISSUE_PHOTOS_DIR)) {
  fs.mkdirSync(ISSUE_PHOTOS_DIR, { recursive: true });
}

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
  'tested_parts_removed',
  'registered',
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
    let status;
    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      const parts = req.query.status
        .split(',')
        .map((s) => s.trim())
        .filter((s) => VALID_STATUSES.has(s));
      if (parts.length > 0) {
        status = parts.join(',');
      }
    }
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
    // intakedOnly: restrict to batteries that arrived via a truck intake and
    // are currently awaiting repair — used by technician scan typeaheads.
    const intakedOnly = req.query.intakedOnly === 'true';
    // Whether in_testing batteries may be suggested is decided by the
    // caller's role only — never by a query flag, which any technician could
    // set from devtools. (Clients may still send includeTesting; it's ignored.)
    let includeTesting = false;
    if (req.user && intakedOnly) {
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        includeTesting = true;
      } else {
        const staff = await staffModel.findByUserId(req.user.id);
        const staffRole = (staff?.role || req.user.staff_role || req.user.role || '').toLowerCase();
        if (staffRole === 'supervisor') {
          includeTesting = true;
        }
      }
    }
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const { rows, hasMore, total } = await batteryModel.findPage({
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
      intakedOnly,
      includeTesting,
      sortOrder,
    });
    res.json({ data: rows, hasMore, total });
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
    const [history, returns, visits, issues, recycleBatch, services, pendingPartsRemoval] = await Promise.all([
      batteryModel.findRepairHistory(battery.id),
      batteryModel.findReturnHistory(battery.id),
      batteryModel.findVisitHistory(battery.id),
      batteryModel.findIssueHistory(battery.id),
      recycleModel.findByBatteryId(battery.id),
      serviceModel.findBatteryServices(battery.id),
      batteryModel.findPendingPartsRemoval(battery.id),
    ]);
    res.json({ battery, history, returns, visits, issues, recycleBatch, services, pendingPartsRemoval });
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
    const battery = await batteryModel.findById(req.params.id);
    if (!battery) {
      return res.status(404).json({ message: 'Battery not found' });
    }

    await batteryModel.remove(req.params.id);

    try {
      await trashModel.record({
        originalId: battery.id,
        itemType: 'battery',
        title: `Battery ${battery.battery_code || ('#' + battery.id)}`,
        subtitle: `Client: ${battery.client_name || 'Unassigned'} • Status: ${battery.status || 'N/A'}`,
        itemData: battery,
        user: req.user,
      });
    } catch (trashErr) {
      console.error('Error logging battery to trash:', trashErr);
    }

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
    res.json({ count: await batteryModel.countByStatus(['unserviceable', 'tested_parts_removed']) });
  } catch (err) {
    next(err);
  }
}

// A technician claiming a battery to start work on, before logging any part.
async function startWork(req, res, next) {
  try {
    const batteryRecord = await batteryModel.findById(req.params.id);
    if (!batteryRecord) {
      return res.status(404).json({ message: 'Battery not found.' });
    }
    if (batteryRecord.truck_intake_id) {
      const intake = await truckIntakeModel.findById(batteryRecord.truck_intake_id);
      if (intake && intake.status === 'pending_arrival' && !intake.verified_at) {
        return res.status(400).json({
          message: `Cannot start work: Truck #${intake.truck_number} arrival has not been verified by the workshop yet.`,
        });
      }
    }
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

// Sets testing_started_at = now() when a Supervisor or Admin scans/opens the battery for testing.
async function startTesting(req, res, next) {
  try {
    let canTest = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!canTest && (req.user.role === 'technician' || req.user.role === 'staff')) {
      const staff = await staffModel.findByUserId(req.user.id);
      const staffRole = (staff?.role || '').toLowerCase();
      if (staffRole === 'supervisor') {
        canTest = true;
      }
    }
    if (!canTest) {
      return res.status(403).json({
        message: 'Technicians do not have access to testing. Only Supervisors can test batteries.',
      });
    }

    const battery = await batteryModel.startTesting(req.params.id);
    if (!battery) {
      return res.status(404).json({ message: 'Battery not found or not in testing status.' });
    }
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
    next(err);
  }
}

// Confirms a battery works after its parts were replaced — restricted to
// Supervisors and Admins (Technicians do not have testing permission).
async function completeTesting(req, res, next) {
  try {
    let staffId = null;
    if (req.user.role === 'technician') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (!staff) {
        return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
      }
      staffId = staff.id;
      const staffRole = (staff.role || '').toLowerCase();
      if (staffRole === 'technician') {
        return res.status(403).json({
          message:
            'Technicians do not have permission to perform testing. Only Supervisors can complete testing.',
        });
      }
    } else if (req.user.role === 'staff' || req.user.role === 'admin' || req.user.role === 'super_admin') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (staff) {
        staffId = staff.id;
      }
    }

    const { serviceIds, notes } = req.body || {};
    const battery = await batteryModel.completeTesting(req.params.id, {
      serviceIds: Array.isArray(serviceIds) ? serviceIds.map(Number).filter(Boolean) : [],
      staffId,
      notes: typeof notes === 'string' ? notes.trim() : null,
    });
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
    // Optional: the mid-repair reason-picker flow's own form requires
    // picking one before it will submit, but the testing-time "mark
    // unserviceable" flow deliberately has no picker (just notes/photo), so
    // the backend doesn't hard-require it either.
    const reasonId = req.body.reasonId ? Number(req.body.reasonId) || null : null;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';

    // Every allowed role must resolve to a staff row: battery_issues.staff_id
    // is NOT NULL, and removed_by_staff_id is the audit trail of who did it.
    const staff = await staffModel.findByUserId(req.user.id);
    if (!staff) {
      return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
    }
    const staffId = staff.id;

    // Process uploaded photos (up to 3) via multipart/form-data or JSON base64
    const photoUrls = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files.slice(0, 3)) {
        const ext = path.extname(file.originalname || '') || '.jpg';
        const safeName = `issue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
        fs.writeFileSync(path.join(ISSUE_PHOTOS_DIR, safeName), file.buffer);
        photoUrls.push(`/uploads/issue-photos/${safeName}`);
      }
    }

    if (req.body.photos) {
      let photosArr = req.body.photos;
      if (typeof photosArr === 'string') {
        try {
          photosArr = JSON.parse(photosArr);
        } catch {
          photosArr = [photosArr];
        }
      }
      if (Array.isArray(photosArr)) {
        for (const item of photosArr) {
          if (photoUrls.length >= 3) break;
          if (typeof item === 'string') {
            if (item.startsWith('data:image/')) {
              const match = item.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
              if (match) {
                const rawExt = match[1].toLowerCase();
                const ext = rawExt.includes('png') ? '.png' : rawExt.includes('webp') ? '.webp' : '.jpg';
                const buffer = Buffer.from(match[2], 'base64');
                const safeName = `issue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
                fs.writeFileSync(path.join(ISSUE_PHOTOS_DIR, safeName), buffer);
                photoUrls.push(`/uploads/issue-photos/${safeName}`);
              }
            } else if (item.startsWith('/uploads/')) {
              photoUrls.push(item);
            }
          }
        }
      }
    }

    const battery = await batteryModel.reportIssue(req.params.id, {
      staffId: staffId,
      reasonId,
      note,
      photoUrls,
    });
    if (!battery) {
      return res.status(409).json({
        message: 'This battery cannot be reported — it must be in progress or in testing first.',
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

// Reclaims parts fitted during repair from a battery that failed testing and
// was declared unserviceable there (rather than caught earlier in
// in_progress, before anything was fitted) — restocks each selected part
// and stamps its repair row so it drops off the pending list. Open to any
// workshop login (technician/supervisor both share the 'technician'
// role — see battery.routes.js), matching who can report the issue itself.
async function removeParts(req, res, next) {
  try {
    const repairIds = Array.isArray(req.body.repairIds)
      ? req.body.repairIds.map(Number).filter(Boolean)
      : [];
    // Every allowed role must resolve to a staff row: battery_issues.staff_id
    // is NOT NULL, and removed_by_staff_id is the audit trail of who did it.
    const staff = await staffModel.findByUserId(req.user.id);
    if (!staff) {
      return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
    }
    const staffId = staff.id;
    const result = await batteryModel.removeParts(req.params.id, repairIds, staffId);
    if (result.removedCount === 0) {
      return res.status(409).json({ message: 'These parts were already removed or do not belong to this battery.' });
    }
    if (result.battery) {
      realtime.broadcastBatteryUpdated(result.battery);
    }
    realtime.broadcastUnserviceableCount().catch((err) => console.error('broadcastUnserviceableCount:', err));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Passes a battery back from 'in_testing' to 'in_repair' so technicians
// can re-work on it after failing testing. Restricted to Supervisors,
// and Admins.
async function passToTech(req, res, next) {
  try {
    let staffId = null;
    if (req.user.role === 'technician') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (!staff) {
        return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
      }
      staffId = staff.id;
      const staffRole = (staff.role || '').toLowerCase();
      if (staffRole === 'technician') {
        return res.status(403).json({
          message:
            'Technicians cannot pass batteries back. Only Supervisors can perform testing and QA decisions.',
        });
      }
    } else if (req.user.role === 'staff' || req.user.role === 'admin' || req.user.role === 'super_admin') {
      const staff = await staffModel.findByUserId(req.user.id);
      if (staff) {
        staffId = staff.id;
      }
    }

    const { note } = req.body || {};
    const battery = await batteryModel.passToTech(req.params.id, {
      staffId,
      note: typeof note === 'string' ? note.trim() : null,
    });
    if (!battery) {
      return res.status(409).json({
        message: 'This battery cannot be passed back to technician — it may not be in testing.',
      });
    }
    realtime.broadcastBatteryUpdated(battery);
    res.json(battery);
  } catch (err) {
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
  startTesting,
  completeTesting,
  reportIssue,
  removeParts,
  passToTech,
  remove,
  setBlocked,
};
