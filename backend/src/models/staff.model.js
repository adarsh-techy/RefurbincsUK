const db = require('../config/db');

// Joins in the linked login account's email (if any) so the Staff page can
// show whether a given staff member has technician login access yet.
async function findAll() {
  const { rows } = await db.query(
    `SELECT s.*, COALESCE(s.email, u.email) AS login_email
     FROM staff s
     LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.name`
  );
  return rows;
}

async function findByUserId(userId) {
  const { rows } = await db.query('SELECT * FROM staff WHERE user_id = $1', [userId]);
  return rows[0];
}

// email/passwordHash are optional — when given, also creates a linked
// `users` login account (role 'technician', forced to set its own password
// on first login) in the same transaction, so a staff member and its login
// can never end up out of sync with each other.
async function create({
  name,
  phone,
  salary,
  role,
  email,
  passwordHash,
  passportNumber,
  niNumber,
  shareCode,
  documentPath,
  documentName,
}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: staffRows } = await client.query(
      `INSERT INTO staff (
        name, phone, salary, role, email, passport_number, ni_number, share_code, document_path, document_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name,
        phone,
        salary || 0,
        role || null,
        email || null,
        passportNumber || null,
        niNumber || null,
        shareCode || null,
        documentPath || null,
        documentName || null,
      ]
    );
    let staffRow = staffRows[0];

    if (email && passwordHash) {
      const { rows: userRows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, permissions, must_change_password)
         VALUES ($1, $2, $3, 'technician', '[]', true)
         RETURNING id`,
        [name, email, passwordHash]
      );
      const { rows: linkedRows } = await client.query(
        'UPDATE staff SET user_id = $2 WHERE id = $1 RETURNING *',
        [staffRow.id, userRows[0].id]
      );
      staffRow = linkedRows[0];
    }

    await client.query('COMMIT');
    return staffRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(id, fields) {
  const sets = [];
  const params = [id];

  const fieldMapping = [
    ['name', 'name'],
    ['phone', 'phone'],
    ['active', 'active'],
    ['salary', 'salary'],
    ['role', 'role'],
    ['email', 'email'],
    ['passport_number', 'passportNumber'],
    ['ni_number', 'niNumber'],
    ['share_code', 'shareCode'],
    ['document_path', 'documentPath'],
    ['document_name', 'documentName'],
  ];

  for (const [col, key] of fieldMapping) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }

  if (sets.length === 0) return findById(id);

  const { rows } = await db.query(
    `UPDATE staff SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM staff WHERE id = $1', [id]);
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT s.*, u.email AS linked_user_email
     FROM staff s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0];
}

// Every repair *visit* this staff member has ever logged, newest first —
// the basis for their detail page's work history and per-day totals.
// Grouped by batch_id (same pattern as repair.model.js's findPage): every
// part changed in one Log Repair / Submit for Testing submission is one
// visit, not one row per part, so a 3-part job reads as one card, not
// three (part_name comes back comma-joined). Includes the battery's
// current status so the work-history list can show whether that battery
// has since moved on or is still in progress.
async function findRepairs(staffId) {
  // price/labor_charge are for the admin Staff detail page only — the
  // technician's own /staff/me strips them (see staff.controller myProfile).
  //
  // battery_status is the battery's status *right now*, which says nothing
  // about a repair done on an earlier visit — so `outcome` works out what
  // happened to THIS job:
  //   failed     its parts were pulled back out, or it's the battery's latest
  //              repair and the battery ended up unserviceable/recycled
  //   completed  the battery passed testing / went back to the client, or
  //              has since been repaired again or returned (an older visit)
  //   active     still in the workshop pipeline after this repair
  const { rows } = await db.query(
    `WITH mine AS (
       SELECT
         MIN(r.id) AS id,
         array_agg(r.id ORDER BY r.id) AS repair_ids,
         r.batch_id,
         r.battery_id,
         b.battery_code,
         b.status AS battery_status,
         string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
         SUM(r.price) AS price,
         SUM(r.labor_charge) AS labor_charge,
         MIN(r.notes) AS notes,
         MIN(r.repaired_at) AS repaired_at,
         MIN(r.duration_seconds) AS duration_seconds,
         bool_and(r.removed_at IS NOT NULL) AS parts_removed,
         MAX(r.removed_at) AS removed_at,
         bool_or(r.removed_by_staff_id = $1) AS removed_by_me,
         bool_or(r.staff_id = $1) AS repaired_by_me
       FROM repairs r
       JOIN batteries b ON b.id = r.battery_id
       JOIN parts p ON p.id = r.part_id
       WHERE r.staff_id = $1 OR r.removed_by_staff_id = $1
       GROUP BY r.batch_id, r.battery_id, b.battery_code, b.status
     )
     SELECT
       m.id, m.repair_ids, m.batch_id, m.battery_code, m.battery_status,
       m.part_name, m.price, m.labor_charge, m.notes, m.repaired_at, m.duration_seconds,
       m.parts_removed, m.removed_at, m.removed_by_me, m.repaired_by_me,
       CASE
         WHEN m.parts_removed THEN 'failed'
         WHEN EXISTS (
           SELECT 1 FROM repairs later
           WHERE later.battery_id = m.battery_id
             AND later.batch_id <> m.batch_id
             AND later.repaired_at > m.repaired_at
         ) THEN 'completed'
         WHEN EXISTS (
           SELECT 1 FROM return_batteries rb
           JOIN returns ret ON ret.id = rb.return_id
           WHERE rb.battery_id = m.battery_id AND ret.returned_at > m.repaired_at
         ) THEN 'completed'
         WHEN m.battery_status IN ('repaired', 'returned') THEN 'completed'
         WHEN m.battery_status IN ('unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'recycled') THEN 'failed'
         ELSE 'active'
       END AS outcome
     FROM mine m
     ORDER BY COALESCE(m.removed_at, m.repaired_at) DESC`,
    [staffId]
  );
  return rows;
}

// Every "can't service" issue this staff member has ever reported, newest
// first — same idea as findRepairs, but for battery_issues instead of
// repairs, so a technician's history shows both kinds of work they've done.
async function findIssues(staffId) {
  const { rows } = await db.query(
    `SELECT
       bi.id,
       b.battery_code,
       b.status AS battery_status,
       COALESCE(ir.label, 'Failed Testing / Unserviceable') AS reason_label,
       bi.note,
       bi.reported_at,
       bi.photo_urls
     FROM battery_issues bi
     JOIN batteries b ON b.id = bi.battery_id
     -- LEFT JOIN: an issue raised from a failed test has no reason_id, and an
     -- inner join silently dropped it from the reporter's history.
     LEFT JOIN issue_reasons ir ON ir.id = bi.reason_id
     WHERE bi.staff_id = $1
     ORDER BY bi.reported_at DESC`,
    [staffId]
  );
  return rows;
}

// Testing/QA work this staff member (a supervisor) has signed off, newest
// first: one row per battery per sign-off, with the test services they
// ticked comma-joined. `passed_back` marks a battery they sent back to the
// technician pool instead of passing. Without this a supervisor's dashboard
// and history only showed repairs they'd done by hand, never their testing.
// No rates selected: this only feeds the technician's own screens.
async function findTests(staffId) {
  const { rows } = await db.query(
    `SELECT
       MIN(bs.id) AS id,
       b.id AS battery_id,
       b.battery_code,
       b.status AS battery_status,
       b.testing_duration_seconds,
       string_agg(bs.service_name, ', ' ORDER BY bs.service_name)
         FILTER (WHERE bs.service_name <> 'Passed back to Technician') AS service_name,
       bool_or(bs.service_name = 'Passed back to Technician') AS passed_back,
       MIN(bs.notes) AS notes,
       bs.completed_at AS tested_at
     FROM battery_services bs
     JOIN batteries b ON b.id = bs.battery_id
     WHERE bs.staff_id = $1
     GROUP BY bs.battery_id, b.id, b.battery_code, b.status, b.testing_duration_seconds, bs.completed_at
     ORDER BY bs.completed_at DESC`,
    [staffId]
  );
  return rows;
}

module.exports = { findAll, findByUserId, create, update, remove, findById, findRepairs, findIssues, findTests };
