const db = require('../config/db');

// Fetches one page of batteries, newest first. Requests limit+1 rows so the
// caller can tell whether there's another page without a separate COUNT(*).
// Optional status filter (e.g. 'repaired') narrows to batteries in that
// state; optional date ('YYYY-MM-DD') narrows to batteries created that day;
// optional q does a partial, case-insensitive match on the battery code
// (used by the live search-as-you-type lookup).
//
// Also brings back each battery's most recent repair (when, which part(s),
// and who did it — grouped by batch_id so a multi-part visit reads as one
// event) plus how many separate repair visits it's had so far this calendar
// month, so the list can flag batteries that keep coming back.
async function findPage({
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
  sortOrder = 'desc',
}) {
  const conditions = [];
  const params = [];

  if (!includeBlocked) {
    conditions.push('b.is_blocked = false');
  }
  if (clientName) {
    params.push(clientName);
    conditions.push(`(lower(b.client_name) = lower($${params.length}) OR EXISTS (SELECT 1 FROM truck_intakes ti JOIN clients c ON c.id = ti.client_id WHERE ti.id = b.truck_intake_id AND lower(c.name) = lower($${params.length})))`);
  }
  if (status) {
    if (status === 'registered') {
      conditions.push(`(b.status = 'registered' OR (b.status = 'returned' AND NOT EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id) AND NOT EXISTS (SELECT 1 FROM battery_visits bv WHERE bv.battery_id = b.id) AND b.truck_intake_id IS NULL))`);
    } else {
      params.push(status);
      conditions.push(`b.status = $${params.length}`);
    }
  }
  if (date) {
    params.push(date);
    conditions.push(`b.created_at::date = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`b.battery_code ILIKE $${params.length}`);
  }
  // Combined battery-ID-or-client-name search, for the Generated QR Codes
  // list — separate from `q` above (which only matches battery_code and is
  // used elsewhere, e.g. the QR-generation typeahead) so that behavior isn't
  // changed for existing callers.
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(b.battery_code ILIKE $${params.length} OR b.client_name ILIKE $${params.length} OR EXISTS (SELECT 1 FROM battery_issues bi JOIN issue_reasons ir ON ir.id = bi.reason_id WHERE bi.battery_id = b.id AND (ir.label ILIKE $${params.length} OR bi.note ILIKE $${params.length})))`
    );
  }
  if (qrGenerated === true) {
    conditions.push('b.qr_generated_at IS NOT NULL');
  } else if (qrGenerated === false) {
    conditions.push('b.qr_generated_at IS NULL');
  }
  // Excludes batteries with nothing left for a technician to do — for the
  // Service screen's scan/search suggestions, so an already-completed or
  // returned battery never shows up as something to start work on.
  if (activeOnly) {
    conditions.push(`b.status NOT IN ('repaired', 'returned', 'unserviceable', 'recycled')`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1, offset);

  const { rows } = await db.query(
    `SELECT b.*,
            CASE
              WHEN b.status = 'returned' 
                   AND NOT EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)
                   AND NOT EXISTS (SELECT 1 FROM battery_visits bv WHERE bv.battery_id = b.id)
                   AND b.truck_intake_id IS NULL
                THEN 'registered'
              ELSE b.status
            END AS status,
            last_repair.repaired_at AS last_repaired_at,
            last_parts.part_names AS last_repaired_parts,
            last_parts.staff_name AS last_repaired_by,
            COALESCE(month_stats.visit_count, 0) AS repairs_this_month,
            month_stats.visit_dates AS repairs_this_month_dates,
            last_issue.reason AS issue_reason,
            last_issue.note AS issue_note,
            last_issue.reported_at AS issue_reported_at,
            last_issue.photo_urls AS issue_photos
     FROM batteries b
     LEFT JOIN LATERAL (
       SELECT r.repaired_at, r.batch_id
       FROM repairs r
       WHERE r.battery_id = b.id
       ORDER BY r.repaired_at DESC
       LIMIT 1
     ) last_repair ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(DISTINCT p.name, ', ') AS part_names, MAX(s.name) AS staff_name
       FROM repairs r2
       JOIN parts p ON p.id = r2.part_id
       JOIN staff s ON s.id = r2.staff_id
       WHERE r2.batch_id = last_repair.batch_id
     ) last_parts ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(DISTINCT r3.batch_id) AS visit_count,
              array_agg(DISTINCT to_char(r3.repaired_at, 'YYYY-MM-DD')
                        ORDER BY to_char(r3.repaired_at, 'YYYY-MM-DD')) AS visit_dates
       FROM repairs r3
       WHERE r3.battery_id = b.id
         AND date_trunc('month', r3.repaired_at) = date_trunc('month', now())
     ) month_stats ON true
     LEFT JOIN LATERAL (
       SELECT ir.label AS reason, bi.note, bi.reported_at, bi.photo_urls
       FROM battery_issues bi
       JOIN issue_reasons ir ON ir.id = bi.reason_id
       WHERE bi.battery_id = b.id
       ORDER BY bi.reported_at DESC
       LIMIT 1
     ) last_issue ON true
     ${whereClause}
     ORDER BY ${qrGenerated ? 'b.qr_generated_at ASC, b.id ASC' : (sortOrder === 'asc' ? 'b.created_at ASC, b.id ASC' : 'b.created_at DESC, b.id DESC')}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const countRes = await db.query(
    `SELECT COUNT(*) AS total FROM batteries b ${whereClause}`,
    countParams
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), hasMore, total };
}

// Joins in the originating truck intake (truck number, driver, date), plus
// whichever technician's currently claimed it (see startWork), so the
// detail page can show the battery's full lifecycle, not just its status.
async function findByCode(batteryCode) {
  const { rows } = await db.query(
    `SELECT b.*,
            CASE
              WHEN b.status = 'returned' 
                   AND NOT EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)
                   AND NOT EXISTS (SELECT 1 FROM battery_visits bv WHERE bv.battery_id = b.id)
                   AND b.truck_intake_id IS NULL
                THEN 'registered'
              ELSE b.status
            END AS status,
            ti.truck_number AS intake_truck_number,
            ti.driver_name AS intake_driver_name,
            ti.intake_at AS intake_at,
            u.name AS started_by_name,
            EXISTS (SELECT 1 FROM battery_ratings br WHERE br.battery_code = b.battery_code) AS already_rated
     FROM batteries b
     LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
     LEFT JOIN users u ON u.id = b.started_by_user_id
     WHERE b.battery_code = $1`,
    [batteryCode]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM batteries WHERE id = $1', [id]);
  return rows[0];
}

// Batched form of findById, for validating a batch of scanned QR codes in
// one round-trip instead of one query per battery.
async function findByIds(ids) {
  if (ids.length === 0) return [];
  const { rows } = await db.query('SELECT * FROM batteries WHERE id = ANY($1::int[])', [ids]);
  return rows;
}

// Every battery associated with a given truck intake, for that intake's
// detail page — lets a manager see exactly which batteries came off which
// truck. Goes through battery_visits rather than batteries.truck_intake_id
// alone, so a returning battery scanned onto this intake shows up here too,
// even though its truck_intake_id still points at its original intake.
async function findByTruckIntakeId(truckIntakeId) {
  const intakeId = Number(truckIntakeId);
  const { rows } = await db.query(
    `SELECT b.*,
            last_repair.repaired_at AS last_repaired_at,
            last_parts.part_names AS last_repaired_parts,
            COALESCE(monthly_visits.intake_count_this_month, 0)::int AS intake_count_this_month,
            COALESCE(monthly_visits.visits_this_month, '[]'::jsonb) AS visits_this_month,
            COALESCE(monthly_repairs.repair_count_this_month, 0)::int AS repair_count_this_month,
            COALESCE(monthly_repairs.repairs_this_month, '[]'::jsonb) AS repairs_this_month
     FROM batteries b
     LEFT JOIN LATERAL (
       SELECT r.repaired_at, r.batch_id
       FROM repairs r
       WHERE r.battery_id = b.id
       ORDER BY r.repaired_at DESC
       LIMIT 1
     ) last_repair ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(DISTINCT p.name, ', ') AS part_names
       FROM repairs r2
       JOIN parts p ON p.id = r2.part_id
       WHERE r2.batch_id = last_repair.batch_id
     ) last_parts ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(bv2.id)::int AS intake_count_this_month,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'visit_id', bv2.id,
               'truck_intake_id', ti2.id,
               'truck_number', ti2.truck_number,
               'driver_name', ti2.driver_name,
               'intake_at', ti2.intake_at,
               'created_at', bv2.created_at,
               'is_current_intake', (ti2.id = $1::int)
             ) ORDER BY ti2.intake_at ASC
           ),
           '[]'::jsonb
         ) AS visits_this_month
       FROM battery_visits bv2
       JOIN truck_intakes ti2 ON ti2.id = bv2.truck_intake_id
       WHERE bv2.battery_id = b.id
         AND date_trunc('month', ti2.intake_at) = date_trunc('month', now())
     ) monthly_visits ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(DISTINCT r3.batch_id)::int AS repair_count_this_month,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'batch_id', r3.batch_id,
               'repaired_at', r3.repaired_at,
               'notes', r3.notes
             )
           ),
           '[]'::jsonb
         ) AS repairs_this_month
       FROM repairs r3
       WHERE r3.battery_id = b.id
         AND date_trunc('month', r3.repaired_at) = date_trunc('month', now())
     ) monthly_repairs ON true
     WHERE b.truck_intake_id = $1::int
        OR EXISTS (
          SELECT 1 FROM battery_visits bv
          WHERE bv.battery_id = b.id AND bv.truck_intake_id = $1::int
        )
     ORDER BY b.battery_code`,
    [intakeId]
  );
  return rows;
}

async function create({ batteryCode, truckIntakeId }) {
  const { rows } = await db.query(
    `INSERT INTO batteries (battery_code, truck_intake_id)
     VALUES ($1, $2) RETURNING *`,
    [batteryCode, truckIntakeId]
  );
  const battery = rows[0];
  await db.query(
    'INSERT INTO battery_visits (battery_id, truck_intake_id) VALUES ($1, $2)',
    [battery.id, truckIntakeId]
  );
  return battery;
}

// Batched form of create, for a truck intake's brand-new batteries — one
// multi-row INSERT (plus one multi-row battery_visits INSERT) instead of a
// per-battery round-trip.
async function createMany(batteryCodes, truckIntakeId) {
  if (batteryCodes.length === 0) return [];
  const { rows } = await db.query(
    `INSERT INTO batteries (battery_code, truck_intake_id)
     SELECT unnest($1::text[]), $2::int
     RETURNING *`,
    [batteryCodes, truckIntakeId]
  );
  await db.query(
    `INSERT INTO battery_visits (battery_id, truck_intake_id)
     SELECT unnest($1::int[]), $2::int`,
    [rows.map((r) => r.id), truckIntakeId]
  );
  return rows;
}

// Registers a battery straight from the Generate QR Code page — not tied to
// a truck intake. battery_code is the client-prefixed internal ID computed
// by the caller (e.g. "UBE-0001"); serial_number is the manufacturer's own
// serial as printed on the unit, kept only for reference. QR is marked
// generated immediately since that's this endpoint's whole purpose.
//
// Status starts at 'returned' rather than the table default of 'in_repair'
// — a battery registered here represents one already with the client, not
// one currently at the shop, so it can be scanned straight into a future
// Truck Intake's "Scan Batteries (returning)" step without being rejected
// as not-yet-returned.
async function createForClient({ batteryCode, serialNumber, clientName }) {
  const { rows } = await db.query(
    `INSERT INTO batteries (battery_code, serial_number, client_name, qr_generated_at, status)
     VALUES ($1, $2, $3, now(), 'returned')
     RETURNING *`,
    [batteryCode, serialNumber || null, clientName || null]
  );
  return rows[0];
}

// Distinct serial numbers already on file, for the Battery Number field's
// "or select" autocomplete.
async function listSerialNumbers() {
  const { rows } = await db.query(
    `SELECT DISTINCT serial_number FROM batteries
     WHERE serial_number IS NOT NULL AND serial_number <> ''
     ORDER BY serial_number LIMIT 200`
  );
  return rows.map((r) => r.serial_number);
}

// Attaches an already-tracked battery (identified by scanning its existing
// QR code) to a NEW truck intake, without touching its original
// truck_intake_id — so its full history keeps every truck that's ever
// brought it in, not just the first. Status resets to 'in_repair' since
// it's back for another round.
async function addVisit(batteryId, truckIntakeId) {
  await db.query(
    'INSERT INTO battery_visits (battery_id, truck_intake_id) VALUES ($1, $2)',
    [batteryId, truckIntakeId]
  );
  const { rows } = await db.query(
    `UPDATE batteries SET status = 'in_repair', started_by_user_id = NULL WHERE id = $1 RETURNING *`,
    [batteryId]
  );
  return rows[0];
}

// Batched form of addVisit, for a truck intake's scanned-in returning
// batteries — one multi-row battery_visits INSERT plus one bulk status
// UPDATE instead of two queries per battery.
async function addVisitMany(batteryIds, truckIntakeId) {
  if (batteryIds.length === 0) return [];
  await db.query(
    `INSERT INTO battery_visits (battery_id, truck_intake_id)
     SELECT unnest($1::int[]), $2::int`,
    [batteryIds, truckIntakeId]
  );
  const { rows } = await db.query(
    `UPDATE batteries SET status = 'in_repair', started_by_user_id = NULL WHERE id = ANY($1::int[]) RETURNING *`,
    [batteryIds]
  );
  return rows;
}

// Every truck intake this battery has ever been part of, oldest first — the
// basis for the detail page's full intake history (not just the first one).
async function findVisitHistory(batteryId) {
  const { rows } = await db.query(
    `SELECT bv.id AS visit_id, ti.id AS truck_intake_id, ti.truck_number,
            ti.driver_name, ti.intake_at
     FROM battery_visits bv
     JOIN truck_intakes ti ON ti.id = bv.truck_intake_id
     WHERE bv.battery_id = $1
     ORDER BY ti.intake_at ASC`,
    [batteryId]
  );
  return rows;
}

// Every issue a technician has reported against this battery (e.g. "Battery
// is dead"), newest first — for the detail page to show why it was marked
// unserviceable.
async function findIssueHistory(batteryId) {
  const { rows } = await db.query(
    `SELECT bi.id, bi.note, bi.reported_at, bi.photo_urls, COALESCE(ir.label, 'Failed Testing / Unserviceable') AS reason_label, s.name AS staff_name
     FROM battery_issues bi
     LEFT JOIN issue_reasons ir ON ir.id = bi.reason_id
     LEFT JOIN staff s ON s.id = bi.staff_id
     WHERE bi.battery_id = $1
     ORDER BY bi.reported_at DESC`,
    [batteryId]
  );
  return rows;
}

async function findRepairHistory(batteryId) {
  const { rows } = await db.query(
    `SELECT r.id, r.batch_id, r.quantity_used, r.notes, r.repaired_at, r.price, r.labor_charge,
            r.duration_seconds, s.id AS staff_id, s.user_id, s.name AS staff_name, p.name AS part_name
     FROM repairs r
     JOIN staff s ON s.id = r.staff_id
     JOIN parts p ON p.id = r.part_id
     WHERE r.battery_id = $1
     ORDER BY r.repaired_at DESC`,
    [batteryId]
  );
  return rows;
}

// Parts fitted to this battery during repair that haven't been physically
// pulled back out and restocked yet — only meaningful once the battery has
// been declared unserviceable after already reaching testing. Empty for a
// battery reported unserviceable straight from 'in_progress', since nothing
// was fitted yet.
async function findPendingPartsRemoval(batteryId) {
  const { rows } = await db.query(
    `SELECT r.id, r.part_id, r.quantity_used, p.name AS part_name, r.repaired_at
     FROM repairs r
     JOIN parts p ON p.id = r.part_id
     WHERE r.battery_id = $1 AND r.removed_at IS NULL
     ORDER BY r.repaired_at ASC`,
    [batteryId]
  );
  return rows;
}

// Reclaims the checked parts back to inventory stock: restocks each part's
// quantity by however much was used, then stamps the repair row so it
// doesn't show up as pending again. Only touches repair rows that actually
// belong to this battery and haven't already been removed, so re-submitting
// or double-checking the same part is a no-op rather than double-restocking.
async function removeParts(batteryId, repairIds, staffId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: targets } = await client.query(
      `SELECT id, part_id, quantity_used FROM repairs
       WHERE battery_id = $1 AND id = ANY($2::int[]) AND removed_at IS NULL
       FOR UPDATE`,
      [batteryId, repairIds]
    );
    for (const t of targets) {
      await client.query('UPDATE parts SET quantity = quantity + $2 WHERE id = $1', [
        t.part_id,
        t.quantity_used,
      ]);
      await client.query(
        'UPDATE repairs SET removed_at = now(), removed_by_staff_id = $2 WHERE id = $1',
        [t.id, staffId]
      );
    }
    await client.query('COMMIT');
    return { removedCount: targets.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Every return shipment this battery has ever been part of (a battery can
// go out, come back for another repair, and go out again), newest first.
async function findReturnHistory(batteryId) {
  const { rows } = await db.query(
    `SELECT ret.id, ret.truck_number, ret.driver_name, ret.returned_at
     FROM return_batteries rb
     JOIN returns ret ON ret.id = rb.return_id
     WHERE rb.battery_id = $1
     ORDER BY ret.returned_at DESC`,
    [batteryId]
  );
  return rows;
}

// Manual status correction (e.g. an admin fixing a mistake). Battery code
// and truck intake are not editable — the code is the immutable tracking ID.
async function updateStatus(id, status) {
  const { rows } = await db.query(
    'UPDATE batteries SET status = $2 WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM batteries WHERE id = $1', [id]);
}

// Hides a battery from every list/lookup app-wide without touching its
// history — for a super admin to pull a bad or duplicate entry out of view
// without permanently deleting it.
async function setBlocked(id, blocked) {
  const { rows } = await db.query(
    'UPDATE batteries SET is_blocked = $2 WHERE id = $1 RETURNING *',
    [id, blocked]
  );
  return rows[0];
}

// A technician claiming a battery to start work — only succeeds from
// 'in_repair' (not yet touched), so it can't be "started" twice or on a
// battery that's already repaired/returned. Stamps started_by_user_id so a
// later re-scan can tell this same technician apart from anyone else while
// it's in_progress. Returns undefined if the battery doesn't exist or isn't
// in a startable state.
async function startWork(id, userId) {
  const { rows } = await db.query(
    `UPDATE batteries SET status = 'in_progress', work_started_at = now(), started_by_user_id = $2
     WHERE id = $1 AND status = 'in_repair'
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}

// A technician verifying a battery works after its parts were replaced —
// only succeeds from 'in_testing' (reached automatically once repairs are
// logged, see repair.model.js create). Stamps how long testing took, same
// pattern as work_started_at -> repairs.duration_seconds for the repair
// phase itself.
async function completeTesting(id, { serviceIds = [], staffId = null, notes = null } = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE batteries
       SET status = 'repaired',
           testing_duration_seconds = EXTRACT(EPOCH FROM (now() - testing_started_at))::int,
           testing_started_at = NULL
       WHERE id = $1 AND status = 'in_testing'
       RETURNING *`,
      [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return undefined;
    }

    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      const { rows: selectedServices } = await client.query(
        'SELECT id, name, rate FROM services WHERE id = ANY($1::int[])',
        [serviceIds]
      );
      for (const s of selectedServices) {
        await client.query(
          `INSERT INTO battery_services (battery_id, service_id, service_name, rate, staff_id, notes, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [id, s.id, s.name, s.rate, staffId, notes]
        );
      }
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// A technician (or, once testing has started, a tester — supervisor/
// manager) reporting that a battery can't be serviced. Succeeds from either
// 'in_progress' (nothing fitted yet) or 'in_testing' (parts already fitted
// during repair — see findPendingPartsRemoval/removeParts for reclaiming
// them before the battery moves on to recycling). Logs the reason + note to
// battery_issues and moves the battery to the terminal 'unserviceable'
// status in one transaction. Returns undefined if the battery doesn't exist
// or isn't in a reportable state.
async function reportIssue(id, { staffId, reasonId, note, photoUrls = [] }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE batteries SET status = 'unserviceable'
       WHERE id = $1 AND status IN ('in_progress', 'in_testing')
       RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return undefined;
    }
    await client.query(
      `INSERT INTO battery_issues (battery_id, staff_id, reason_id, note, photo_urls)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, staffId, reasonId, note || null, Array.isArray(photoUrls) ? photoUrls : []]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// A supervisor / manager / tester passing a battery back to the technician
// pool from 'in_testing' — resets testing timestamps and reverts status to
// 'in_repair' so it can be re-worked, logging an optional note.
async function passToTech(id, { staffId = null, note = null } = {}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE batteries
       SET status = 'in_repair',
           testing_started_at = NULL,
           work_started_at = NULL,
           started_by_user_id = NULL
       WHERE id = $1 AND status = 'in_testing'
       RETURNING *`,
      [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return undefined;
    }

    if (note) {
      await client.query(
        `INSERT INTO battery_services (battery_id, service_id, service_name, rate, staff_id, notes, completed_at)
         VALUES ($1, NULL, 'Passed back to Technician', 0, $2, $3, now())`,
        [id, staffId, note]
      );
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Sets which client a battery belongs to and marks its QR code as
// generated — used when generating its QR code, so scanning it later shows
// who it's for. Open to any authenticated user (unlike the super_admin-only
// status correction), since assigning a client is a routine front-desk
// action, not an admin override. Guarded by `qr_generated_at IS NULL` so a
// battery can only ever get one QR code — returns undefined (no row
// updated) if one was already generated or the battery doesn't exist, and
// the caller distinguishes the two.
//
// newCode, when given, also renames the battery's public code (e.g. from a
// generic intake code like "BAT-16-147" to a client-prefixed one like
// "UBE-0001") — permanently, since this is the code the freshly-printed QR
// will encode. Throws a unique-violation (23505) if that code is taken.
async function updateClientName(id, clientName, newCode) {
  const { rows } = await db.query(
    `UPDATE batteries
     SET client_name = $2, qr_generated_at = now()${newCode ? ', battery_code = $3' : ''}
     WHERE id = $1 AND qr_generated_at IS NULL
     RETURNING *`,
    newCode ? [id, clientName || null, newCode] : [id, clientName || null]
  );
  return rows[0];
}

// Counts how many batteries already belong to this client (exact,
// case-insensitive match), so the Generate QR Code form can suggest the
// next battery number for that client (e.g. Uber's 6th battery -> 0006).
async function countByClientName(clientName) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM batteries WHERE lower(client_name) = lower($1)',
    [clientName]
  );
  return rows[0].count;
}

// Powers the Unserviceable Batteries page's 100-battery popup alert.
async function countByStatus(status) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM batteries WHERE status = $1', [status]);
  return rows[0].count;
}

// Batteries that have come in on more than one truck intake within the
// current calendar month — a repeat-intake flag surfaced in the navbar so
// staff notice a battery bouncing back in unusually fast, same spirit as
// findPage's "repaired 3x this month" flag but for intakes rather than
// repairs.
async function findRepeatIntakesThisMonth() {
  const { rows } = await db.query(`
    SELECT b.id, b.battery_code, b.client_name,
           COUNT(bv.id)::int AS intake_count,
           array_agg(ti.intake_at ORDER BY ti.intake_at) AS intake_times
    FROM battery_visits bv
    JOIN batteries b ON b.id = bv.battery_id
    JOIN truck_intakes ti ON ti.id = bv.truck_intake_id
    WHERE date_trunc('month', ti.intake_at) = date_trunc('month', now())
    GROUP BY b.id, b.battery_code, b.client_name
    HAVING COUNT(bv.id) > 1
    ORDER BY COUNT(bv.id) DESC, b.battery_code
  `);
  return rows;
}

// Bulk creates batteries for a client directly from Generate QR Code page (1 to 50,000 QR codes).
// Uses PostgreSQL generate_series for ultra-fast multi-row insertion in a single query.
async function createManyForClient({ clientName, count, startNumber }) {
  const prefix = clientName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const start = Number(startNumber) > 0 ? Number(startNumber) : (await maxSequenceByClientName(clientName)) + 1;
  const end = start + Number(count) - 1;
  const padLength = Math.max(4, String(end).length);

  const { rows } = await db.query(
    `INSERT INTO batteries (battery_code, client_name, qr_generated_at, status)
     SELECT
       $1 || '-' || LPAD(s::text, $2::int, '0'),
       $3,
       now(),
       'returned'
     FROM generate_series($4::int, $5::int) AS s
     RETURNING battery_code`,
    [prefix, padLength, clientName.trim(), start, end]
  );

  return {
    count: rows.length,
    firstCode: rows[0]?.battery_code || `${prefix}-${String(start).padStart(padLength, '0')}`,
    lastCode: rows[rows.length - 1]?.battery_code || `${prefix}-${String(end).padStart(padLength, '0')}`,
  };
}

async function maxSequenceByClientName(clientName) {
  const prefix = clientName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const { rows } = await db.query(
    // Restricted to a purely-numeric suffix so a legacy/manually-entered
    // code like "HUM-A1B2" for this client prefix can't blow up the ::int
    // cast — it's just excluded from the max instead.
    `SELECT COALESCE(MAX(regexp_replace(battery_code, '^.*-', '')::int), 0) AS max_seq
     FROM batteries
     WHERE battery_code LIKE $1
       AND regexp_replace(battery_code, '^.*-', '') ~ '^[0-9]+$'`,
    [`${prefix}-%`]
  );
  return rows[0].max_seq;
}

async function updateSerialNumber(id, { serialNumber, addedByRole }) {
  const hasSerial = Boolean(serialNumber && serialNumber.trim());
  const { rows } = await db.query(
    `UPDATE batteries
     SET serial_number = $2,
         serial_number_added_by_role = $3,
         serial_number_added_at = ${hasSerial ? 'now()' : 'NULL'}
     WHERE id = $1
     RETURNING *`,
    [id, hasSerial ? serialNumber.trim() : null, hasSerial ? (addedByRole || 'client') : null]
  );
  return rows[0];
}

async function findTimeline(batteryId) {
  const [intakes, repairs, returns, issues] = await Promise.all([
    db.query(
      `SELECT ti.id, ti.truck_number, ti.driver_name, ti.intake_at,
              COALESCE(c.name, '(No client assigned)') AS client_name,
              c.id AS client_id
       FROM battery_visits bv
       JOIN truck_intakes ti ON ti.id = bv.truck_intake_id
       LEFT JOIN clients c ON c.id = ti.client_id
       WHERE bv.battery_id = $1
       ORDER BY ti.intake_at DESC`,
      [batteryId]
    ),
    db.query(
      `SELECT r.batch_id, r.repaired_at, s.name AS staff_name,
              string_agg(p.name, ', ' ORDER BY p.name) AS part_names,
              COUNT(r.id) AS parts_count,
              SUM(r.price + r.labor_charge) AS total_charge
       FROM repairs r
       JOIN parts p ON p.id = r.part_id
       JOIN staff s ON s.id = r.staff_id
       WHERE r.battery_id = $1
       GROUP BY r.batch_id, r.repaired_at, s.name
       ORDER BY r.repaired_at DESC`,
      [batteryId]
    ),
    db.query(
      `SELECT ret.id, ret.truck_number, ret.driver_name, ret.returned_at
       FROM return_batteries rb
       JOIN returns ret ON ret.id = rb.return_id
       WHERE rb.battery_id = $1
       ORDER BY ret.returned_at DESC`,
      [batteryId]
    ),
    db.query(
      `SELECT bi.id, bi.note, bi.reported_at, ir.label AS reason
       FROM battery_issues bi
       JOIN issue_reasons ir ON ir.id = bi.reason_id
       WHERE bi.battery_id = $1
       ORDER BY bi.reported_at DESC`,
      [batteryId]
    ),
  ]);

  return {
    intakes: intakes.rows,
    repairs: repairs.rows,
    returns: returns.rows,
    issues: issues.rows,
  };
}

module.exports = {
  findPage,
  findByCode,
  findById,
  findByIds,
  findByTruckIntakeId,
  create,
  createMany,
  createManyForClient,
  maxSequenceByClientName,
  updateSerialNumber,
  findTimeline,
  addVisit,
  addVisitMany,
  findVisitHistory,
  findRepairHistory,
  findPendingPartsRemoval,
  removeParts,
  findIssueHistory,
  findReturnHistory,
  startWork,
  completeTesting,
  reportIssue,
  passToTech,
  updateStatus,
  updateClientName,
  countByClientName,
  countByStatus,
  createForClient,
  listSerialNumbers,
  findRepeatIntakesThisMonth,
  remove,
  setBlocked,
};
