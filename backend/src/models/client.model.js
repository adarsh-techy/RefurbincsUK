const db = require('../config/db');
const serviceModel = require('./service.model');

// Joins in the linked login account's email and permissions so the Clients page
// and permission management can view and manage client dashboard access.
async function findAll() {
  const { rows } = await db.query(
    `SELECT c.*, u.email AS login_email, u.role AS user_role, u.permissions AS user_permissions, u.active AS user_active
     FROM clients c
     LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.name`
  );
  return rows;
}

async function findByUserId(userId) {
  const { rows } = await db.query('SELECT * FROM clients WHERE user_id = $1', [userId]);
  return rows[0];
}

// Same login-email and permissions join as findAll, for the admin-facing client detail page.
async function findById(id) {
  const { rows } = await db.query(
    `SELECT c.*, u.email AS login_email, u.role AS user_role, u.permissions AS user_permissions, u.active AS user_active
     FROM clients c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0];
}

// A battery belongs to a client through either of two independent paths
// that were never reconciled: an older one where the *truck intake* it
// arrived on is tagged with a client_id, and the current one (Generate QR
// Code) where the *battery itself* just carries the client's name as text.
// Every client-scoped query needs both, or a client whose batteries were
// all registered through Generate QR Code sees nothing at all.
const CLIENT_BATTERY_IDS_CTE = `
  client_battery_ids AS (
    SELECT b.id, b.battery_code, b.serial_number, b.status, b.created_at, b.qr_generated_at, b.truck_intake_id, b.notes
    FROM batteries b
    JOIN truck_intakes ti ON ti.id = b.truck_intake_id
    WHERE ti.client_id = $1
    UNION
    SELECT b.id, b.battery_code, b.serial_number, b.status, b.created_at, b.qr_generated_at, b.truck_intake_id, b.notes
    FROM batteries b
    WHERE lower(b.client_name) = lower($2)
    UNION
    SELECT rb.battery_id AS id, b.battery_code, b.serial_number, b.status, b.created_at, b.qr_generated_at, b.truck_intake_id, b.notes
    FROM returns ret
    JOIN return_batteries rb ON rb.return_id = ret.id
    JOIN batteries b ON b.id = rb.battery_id
    WHERE ret.client_id = $1
      -- A return recorded against this client must never pull in a battery
      -- that is explicitly tagged to a different client (mis-picked on the
      -- dispatch form) — that would bill the same charges to two companies.
      AND (b.client_name IS NULL OR lower(b.client_name) = lower($2))
  )
`;

// A battery is billable from the moment the workshop first verified it on
// ANY visit (battery_visits, plus its original intake for legacy rows), not
// just its current truck_intake_id — that column is overwritten on every
// re-pack, which would silently drop earlier visits' charges. A battery with
// no verified visit at all (QR-registered, legacy data) falls back to billing
// every charge, matching the original behaviour.
const BILLABLE_BATTERIES_CTE = `
  billable AS (
    SELECT cb.id, fv.first_verified_at
    FROM client_battery_ids cb
    LEFT JOIN LATERAL (
      SELECT MIN(COALESCE(ti.verified_at, v.visited_at)) AS first_verified_at
      FROM (
        SELECT bv.truck_intake_id, bv.created_at AS visited_at
        FROM battery_visits bv WHERE bv.battery_id = cb.id
        UNION
        SELECT b0.truck_intake_id, b0.created_at
        FROM batteries b0 WHERE b0.id = cb.id AND b0.truck_intake_id IS NOT NULL
      ) v
      JOIN truck_intakes ti ON ti.id = v.truck_intake_id
      WHERE ti.status = 'verified' OR ti.verified_at IS NOT NULL
    ) fv ON true
  )
`;

// Battery counts by status plus total repair visits and balance owed
// (price + labor_charge summed across every part logged, same math as the
// "Total Repair Cost" shown on a battery's own detail page) for every
// battery belonging to this client (see CLIENT_BATTERY_IDS_CTE above).
async function getDashboardStats(clientId, clientName) {
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE},
     ${BILLABLE_BATTERIES_CTE}
     SELECT
       COUNT(DISTINCT b.id) AS battery_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_repair') AS in_repair_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_progress') AS in_progress_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_testing') AS in_testing_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'repaired') AS repaired_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'unserviceable') AS unserviceable_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'returned' AND EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)) AS returned_count,
       COUNT(DISTINCT r.batch_id) AS repair_visit_count,
       (
         COALESCE((
           SELECT SUM(r.price + r.labor_charge)
           FROM billable bb
           JOIN repairs r ON r.battery_id = bb.id
           WHERE bb.first_verified_at IS NULL
              OR r.repaired_at >= bb.first_verified_at - INTERVAL '1 minute'
         ), 0)
         +
         COALESCE((
           SELECT SUM(bs.rate)
           FROM billable bb
           JOIN battery_services bs ON bs.battery_id = bb.id
           WHERE bb.first_verified_at IS NULL
              OR bs.completed_at >= bb.first_verified_at - INTERVAL '1 minute'
         ), 0)
       ) AS balance
     FROM client_battery_ids cb
     JOIN batteries b ON b.id = cb.id
     LEFT JOIN repairs r ON r.battery_id = b.id`,
    [clientId, clientName]
  );
  return rows[0];
}

// email/passwordHash are optional — when given, also creates a linked
// `users` login account (role 'client', forced to set its own password on
// first login) in the same transaction, with specified dashboard permissions.
async function create({ name, invoiceEmail, email, passwordHash, role = 'client', permissions = [], logoPath }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: clientRows } = await client.query(
      'INSERT INTO clients (name, invoice_email, logo_path) VALUES ($1, $2, $3) RETURNING *',
      [name, invoiceEmail ? invoiceEmail.trim() : null, logoPath || null]
    );
    let clientRow = clientRows[0];

    if (email && passwordHash) {
      const userRole = role === 'recycle_client' ? 'recycle_client' : 'client';
      const { rows: userRows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, permissions, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [name, email, passwordHash, userRole, JSON.stringify(permissions || [])]
      );
      const { rows: linkedRows } = await client.query(
        'UPDATE clients SET user_id = $2 WHERE id = $1 RETURNING *',
        [clientRow.id, userRows[0].id]
      );
      clientRow = linkedRows[0];
    }

    await client.query('COMMIT');
    return clientRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(id, { name, invoiceEmail, logoPath, email, passwordHash, permissions, active }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const clientUpdates = ['name = $2'];
    const clientParams = [id, name];

    if (invoiceEmail !== undefined) {
      clientParams.push(invoiceEmail ? invoiceEmail.trim() : null);
      clientUpdates.push(`invoice_email = $${clientParams.length}`);
    }

    if (logoPath !== undefined) {
      clientParams.push(logoPath);
      clientUpdates.push(`logo_path = $${clientParams.length}`);
    }

    const { rows } = await client.query(
      `UPDATE clients SET ${clientUpdates.join(', ')} WHERE id = $1 RETURNING *`,
      clientParams
    );
    let clientRow = rows[0];

    if (!clientRow) {
      await client.query('ROLLBACK');
      return null;
    }

    // If client is linked to a user login account, update their permissions, email, active status or password
    if (clientRow.user_id) {
      const updates = [];
      const params = [clientRow.user_id];

      if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${params.length}`);
      }
      if (email !== undefined && email.trim()) {
        params.push(email.trim());
        updates.push(`email = $${params.length}`);
      }
      if (passwordHash) {
        params.push(passwordHash);
        updates.push(`password_hash = $${params.length}`);
        updates.push(`must_change_password = true`);
      }
      if (permissions !== undefined) {
        params.push(JSON.stringify(permissions || []));
        updates.push(`permissions = $${params.length}`);
      }
      if (active !== undefined) {
        // Comes through as the literal string "false"/"true" over
        // multipart form-data (ClientForm submits via FormData) —
        // Boolean("false") is true, so a naive cast always activates.
        params.push(active === true || active === 'true');
        updates.push(`active = $${params.length}`);
      }

      if (updates.length > 0) {
        await client.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
          params
        );
      }
    } else if (email && passwordHash) {
      // Provision user account for client if they had no login before
      const { rows: userRows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, permissions, must_change_password)
         VALUES ($1, $2, $3, 'client', $4, true)
         RETURNING id`,
        [name, email, passwordHash, JSON.stringify(permissions || [])]
      );
      const { rows: linkedRows } = await client.query(
        'UPDATE clients SET user_id = $2 WHERE id = $1 RETURNING *',
        [clientRow.id, userRows[0].id]
      );
      clientRow = linkedRows[0];
    }

    await client.query('COMMIT');
    return clientRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function remove(id) {
  await db.query('DELETE FROM clients WHERE id = $1', [id]);
}

// Which battery statuses fall into each of the client dashboard's 3 lists.
// Every status maps to exactly one bucket: 'packed' (just arrived, not
// started), 'pending' (work started or finished but not yet shipped back),
// 'received' (physically back with the client via admin return dispatch).
const BUCKET_STATUSES = {
  packed: ['in_repair'],
  pending: ['in_repair', 'in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired', 'unserviceable'],
  received: ['returned'],
};

async function findMyBatteries(clientId, clientName, bucket) {
  const statuses = BUCKET_STATUSES[bucket];
  const conditions = [];
  const params = [clientId, clientName];

  if (bucket === 'received') {
    // Preserve full history of every received truck / return dispatch for this client all time,
    // even if a battery in it is subsequently re-packed or sent back to service.
    const { rows } = await db.query(
      `WITH ${CLIENT_BATTERY_IDS_CTE}
       SELECT b.id, b.battery_code, b.serial_number, b.serial_number_added_by_role, b.serial_number_added_at,
              b.status, b.notes, b.created_at, b.truck_intake_id,
              ti.id AS intake_id, ti.truck_number, ti.driver_name, ti.intake_at, ti.status AS intake_status, ti.verified_at,
              last_repair.repaired_at AS last_repaired_at,
              ret.id AS return_id, ret.truck_number AS return_truck, ret.driver_name AS return_driver, ret.returned_at AS return_date,
              ret.status AS return_status, ret.verified_at AS return_verified_at
       FROM returns ret
       JOIN return_batteries rb ON rb.return_id = ret.id
       JOIN client_battery_ids cb ON cb.id = rb.battery_id
       JOIN batteries b ON b.id = cb.id
       LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
       LEFT JOIN LATERAL (
         SELECT r.repaired_at
         FROM repairs r
         WHERE r.battery_id = b.id
         ORDER BY r.repaired_at DESC
         LIMIT 1
       ) last_repair ON true
       WHERE (ret.client_id = $1 OR lower(b.client_name) = lower($2))
       ORDER BY ret.returned_at DESC, b.battery_code ASC`,
      [clientId, clientName]
    );
    return rows;
  } else if (bucket === 'packed') {
    // Every truck ever packed for repair, whether it's still pending arrival
    // at the workshop or has already arrived and is awaiting technician
    // pickup — the client should see every packed truck here, not just the
    // ones that haven't arrived yet.
    conditions.push(`b.status = 'in_repair'`);
  } else if (bucket === 'pending') {
    conditions.push(`b.status IN ('in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired', 'unserviceable')`);
  } else if (statuses) {
    params.push(statuses);
    conditions.push(`b.status = ANY($${params.length}::text[])`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE}
     SELECT b.id, b.battery_code, b.serial_number, b.serial_number_added_by_role, b.serial_number_added_at,
            b.status, b.notes, b.created_at, b.truck_intake_id,
            ti.id AS intake_id, ti.truck_number, ti.driver_name, ti.intake_at, ti.status AS intake_status, ti.verified_at,
            last_repair.repaired_at AS last_repaired_at,
            last_return.return_id, last_return.return_truck, last_return.return_driver, last_return.return_date,
            last_return.return_status, last_return.return_verified_at
     FROM client_battery_ids cb
     JOIN batteries b ON b.id = cb.id
     LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
     LEFT JOIN LATERAL (
       SELECT r.repaired_at
       FROM repairs r
       WHERE r.battery_id = b.id
       ORDER BY r.repaired_at DESC
       LIMIT 1
     ) last_repair ON true
     LEFT JOIN LATERAL (
       SELECT ret.id AS return_id, ret.truck_number AS return_truck, ret.driver_name AS return_driver, ret.returned_at AS return_date,
              ret.status AS return_status, ret.verified_at AS return_verified_at
       FROM return_batteries rb
       JOIN returns ret ON ret.id = rb.return_id
       WHERE rb.battery_id = b.id
       ORDER BY ret.returned_at DESC
       LIMIT 1
     ) last_return ON true
     ${whereClause}
     ORDER BY b.created_at DESC`,
    params
  );
  return rows;
}

// Every repair and service charge across every battery belonging to this client,
// strictly calculated ONLY after the battery has been received and verified at the workshop.
async function findMyTransactions(clientId, clientName) {
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE},
     ${BILLABLE_BATTERIES_CTE},
     verified_batteries AS (
       SELECT
         cb.id,
         cb.battery_code,
         cb.status,
         li.intake_id,
         li.truck_number,
         li.driver_name,
         li.intake_status,
         bb.first_verified_at AS verified_at
       FROM client_battery_ids cb
       JOIN billable bb ON bb.id = cb.id
       LEFT JOIN LATERAL (
         SELECT ti.id AS intake_id, ti.truck_number, ti.driver_name, ti.status AS intake_status
         FROM battery_visits bv
         JOIN truck_intakes ti ON ti.id = bv.truck_intake_id
         WHERE bv.battery_id = cb.id
         ORDER BY bv.created_at DESC
         LIMIT 1
       ) li ON true
     ),
     repair_lines AS (
       SELECT
         'rep_' || r.batch_id::text AS id,
         r.batch_id,
         vb.id AS battery_id,
         vb.battery_code,
         vb.status AS battery_status,
         vb.truck_number,
         vb.verified_at,
         'repair' AS charge_type,
         string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
         string_agg(p.name, ', ' ORDER BY p.name) AS description,
         MAX(s.name) AS staff_name,
         SUM(r.price + r.labor_charge) AS amount,
         MIN(r.repaired_at) AS repaired_at,
         MAX(r.notes) AS notes
       FROM verified_batteries vb
       JOIN repairs r ON r.battery_id = vb.id
       LEFT JOIN parts p ON p.id = r.part_id
       LEFT JOIN staff s ON s.id = r.staff_id
       WHERE vb.verified_at IS NULL
          OR r.repaired_at >= vb.verified_at - INTERVAL '1 minute'
       GROUP BY r.batch_id, vb.id, vb.battery_code, vb.status, vb.truck_number, vb.verified_at
     ),
     service_lines AS (
       SELECT
         'srv_' || bs.id::text AS id,
         bs.batch_id,
         vb.id AS battery_id,
         vb.battery_code,
         vb.status AS battery_status,
         vb.truck_number,
         vb.verified_at,
         'service' AS charge_type,
         bs.service_name AS part_name,
         bs.service_name AS description,
         COALESCE(s.name, 'Workshop') AS staff_name,
         bs.rate AS amount,
         bs.completed_at AS repaired_at,
         bs.notes AS notes
       FROM verified_batteries vb
       JOIN battery_services bs ON bs.battery_id = vb.id
       LEFT JOIN staff s ON s.id = bs.staff_id
       WHERE vb.verified_at IS NULL
          OR bs.completed_at >= vb.verified_at - INTERVAL '1 minute'
     ),
     all_lines AS (
       SELECT * FROM repair_lines
       UNION ALL
       SELECT * FROM service_lines
     )
     SELECT * FROM all_lines
     ORDER BY repaired_at DESC NULLS LAST`,
    [clientId, clientName]
  );
  return rows;
}

// Timeline feed of lifecycle notifications for the client's batteries:
// Only 3 key events:
// 1. Verified Truck Intakes (when shop/client verifies arrival & intakes batteries)
// 2. Packed for Return (when batteries are dispatched/returned to client)
// 3. Invoice Sent (when invoices are issued for services)
async function findMyNotifications(clientId, clientName, { limit = 50, offset = 0, type } = {}) {
  const filterClause = type && type !== 'all' ? `WHERE type = '${type}'` : '';
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE},
     events AS (
       -- 1. Verified Truck Intake Batch Event (Only when batteries are verified & received)
       SELECT 
         'intake_batch_' || ti.id::text AS id,
         COUNT(DISTINCT b.id)::int AS battery_count,
         array_agg(DISTINCT b.battery_code ORDER BY b.battery_code) AS battery_codes,
         ti.id AS reference_id,
         ti.truck_number,
         ti.driver_name,
         ti.status AS intake_status,
         COALESCE(ti.verified_at, ti.created_at) AS packed_at,
         ti.verified_at AS received_shop_at,
         'intake' AS type,
         'Battery Intake Verified' AS title,
         COUNT(DISTINCT b.id)::text || ' batteries verified & received at workshop on Truck ' || ti.truck_number || COALESCE(' (Driver: ' || ti.driver_name || ')', '') AS message,
         COALESCE(ti.verified_at, ti.created_at, MIN(b.created_at)) AS timestamp
       FROM client_battery_ids b
       JOIN truck_intakes ti ON ti.id = b.truck_intake_id
       WHERE ti.verified_at IS NOT NULL OR ti.status = 'verified'
       GROUP BY ti.id, ti.truck_number, ti.driver_name, ti.status, ti.created_at, ti.verified_at, ti.intake_at

       UNION ALL

       -- 2. Batch Return Event (Packed & Dispatched for Return to Client)
       SELECT 
         'return_batch_' || ret.id::text AS id,
         COUNT(DISTINCT b.id)::int AS battery_count,
         array_agg(DISTINCT b.battery_code ORDER BY b.battery_code) AS battery_codes,
         ret.id AS reference_id,
         ret.truck_number,
         ret.driver_name,
         'returned' AS intake_status,
         ret.returned_at AS packed_at,
         ret.returned_at AS received_shop_at,
         'return' AS type,
         'Batteries Packed for Return' AS title,
         COUNT(DISTINCT b.id)::text || ' batteries packed and dispatched for return on Truck ' || ret.truck_number || COALESCE(' (Driver: ' || ret.driver_name || ')', '') AS message,
         ret.returned_at AS timestamp
       FROM client_battery_ids b
       JOIN return_batteries rb ON rb.battery_id = b.id
       JOIN returns ret ON ret.id = rb.return_id
       GROUP BY ret.id, ret.truck_number, ret.driver_name, ret.returned_at

       UNION ALL

       -- 3. Invoice Sent Event
       SELECT 
         'invoice_' || i.id::text AS id,
         1 AS battery_count,
         ARRAY[]::text[] AS battery_codes,
         i.id AS reference_id,
         NULL AS truck_number,
         NULL AS driver_name,
         'issued' AS intake_status,
         COALESCE(i.created_at, i.issue_date::timestamptz) AS packed_at,
         COALESCE(i.created_at, i.issue_date::timestamptz) AS received_shop_at,
         'invoice' AS type,
         'Invoice Issued: ' || i.invoice_number AS title,
         COALESCE(i.notes, 'Official PDF invoice document ' || i.invoice_number || ' has been issued for your battery services.') AS message,
         COALESCE(i.created_at, i.issue_date::timestamptz) AS timestamp
       FROM invoices i
       WHERE i.client_id = $1
     )
     SELECT * FROM events
     ${filterClause}
     ORDER BY timestamp DESC
     LIMIT $3 OFFSET $4`,
    [clientId, clientName, limit, offset]
  );
  return rows;
}

async function packBatteryForRepair(clientId, clientName, { batteryCode, serialNumber, truckNumber, driverName, issueDescription, batteries }) {
  const truck = (truckNumber || '').trim() || null;
  const driver = (driverName || '').trim() || null;

  // Normalize list of items to pack
  let items = [];
  if (Array.isArray(batteries) && batteries.length > 0) {
    items = batteries
      .map((b) => ({
        code: (b.code || b.batteryCode || '').trim().toUpperCase(),
        serial: (b.serial || b.serialNumber || '').trim() || null,
        issue: (b.issue || b.issueDescription || '').trim() || null,
      }))
      .filter((b) => b.code);
  } else if (batteryCode) {
    items = [{
      code: (batteryCode || '').trim().toUpperCase(),
      serial: (serialNumber || '').trim() || null,
      issue: (issueDescription || '').trim() || null,
    }];
  }

  if (items.length === 0) {
    throw new Error('At least one battery code is required.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let intakeId = null;

    if (truck) {
      // Always create a new truck intake row for this batch, even if the
      // same truck number was used earlier. Each packing action creates a
      // fresh, independent shipment.
      const { rows: newIntakeRows } = await client.query(
        `INSERT INTO truck_intakes (truck_number, driver_name, client_id, battery_count, status, intake_at, created_at)
         VALUES ($1, $2, $3, $4, 'pending_arrival', now(), now())
         RETURNING id`,
        [truck, driver || 'Driver', clientId, items.length]
      );
      intakeId = newIntakeRows[0].id;
    }

    const processed = [];

    for (const item of items) {
      // 1. Find if battery exists by code or serial
      let { rows: existingRows } = await client.query(
        `SELECT * FROM batteries WHERE upper(battery_code) = upper($1) OR (serial_number IS NOT NULL AND upper(serial_number) = upper($1))`,
        [item.code]
      );

      let battery = existingRows[0];

      if (battery) {
        // Update battery to in_repair and link intake if provided
        const { rows: updatedRows } = await client.query(
          `UPDATE batteries
           SET status = 'in_repair',
               client_name = COALESCE(client_name, $2),
               serial_number = COALESCE($3::text, serial_number),
               serial_number_added_by_role = CASE WHEN $3::text IS NOT NULL THEN 'client' ELSE serial_number_added_by_role END,
               truck_intake_id = COALESCE($4::integer, truck_intake_id),
               notes = CASE WHEN $5::text IS NOT NULL THEN COALESCE(notes || E'\n' || $5::text, $5::text) ELSE notes END
           WHERE id = $1
           RETURNING *`,
          [battery.id, clientName, item.serial, intakeId, item.issue ? `[Packed for Repair by Client]: ${item.issue}` : null]
        );
        processed.push(updatedRows[0]);
      } else {
        // Create new battery registered directly under this client and marked in_repair
        const { rows: newRows } = await client.query(
          `INSERT INTO batteries (battery_code, client_name, serial_number, serial_number_added_by_role, truck_intake_id, status, notes, created_at)
           VALUES ($1, $2, $3::text, CASE WHEN $3::text IS NOT NULL THEN 'client' ELSE NULL END, $4::integer, 'in_repair', $5::text, now())
           RETURNING *`,
          [item.code, clientName, item.serial, intakeId, item.issue ? `[Packed for Repair by Client]: ${item.issue}` : null]
        );
        processed.push(newRows[0]);
      }
    }

    if (intakeId) {
      // Recount from the actual linked rows rather than trusting items.length,
      // so re-submitting a battery already on this truck (allowed by the
      // client so it can keep adding to a still-open shipment) never
      // inflates the displayed count.
      await client.query(
        `UPDATE truck_intakes SET battery_count = (SELECT COUNT(*)::int FROM batteries WHERE truck_intake_id = $1) WHERE id = $1`,
        [intakeId]
      );
    }

    await client.query('COMMIT');
    return processed.length === 1 ? processed[0] : processed;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Comprehensive lifecycle history of all truck shipments and batch movements for the client
async function findMyHistory(clientId, clientName, { type, search, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [clientId, clientName];

  if (type && type !== 'all') {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const sIdx = params.length;
    conditions.push(`(
      lower(details) LIKE $${sIdx} OR
      lower(coalesce(vehicle_number, '')) LIKE $${sIdx} OR
      lower(coalesce(driver_name, '')) LIKE $${sIdx} OR
      lower(coalesce(reference, '')) LIKE $${sIdx} OR
      lower(type_label) LIKE $${sIdx}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE},
     events AS (
       -- 1. Truck Intakes (Packed / Workshop Intakes - strictly grouped by truck intake ID)
       SELECT 
         'truck_intake_' || ti.id::text AS id,
         CASE WHEN ti.verified_at IS NOT NULL OR ti.status = 'verified' THEN 'intake' ELSE 'packed' END AS type,
         CASE WHEN ti.verified_at IS NOT NULL OR ti.status = 'verified' THEN 'Workshop Truck Intake' ELSE 'Truck Packed for Repair' END AS type_label,
         COUNT(DISTINCT b.id)::text || ' batteries on Truck ' || COALESCE(ti.truck_number, '#' || ti.id::text) || COALESCE(' (Driver: ' || ti.driver_name || ')', '') AS details,
         COUNT(DISTINCT b.id)::int AS battery_count,
         'Truck ' || COALESCE(ti.truck_number, '#' || ti.id::text) AS reference,
         ti.truck_number AS vehicle_number,
         ti.driver_name,
         NULL AS staff_name,
         NULL::numeric AS amount,
         (ti.verified_at IS NOT NULL OR ti.status = 'verified') AS verified_by_client,
         COALESCE(ti.intake_at, ti.created_at) AS timestamp,
         jsonb_agg(
           jsonb_build_object(
             'id', b.id,
             'code', b.battery_code,
             'serial', b.serial_number,
             'notes', b.notes,
             'status', b.status
           ) ORDER BY b.battery_code
         ) AS batteries_list
       FROM client_battery_ids b
       JOIN truck_intakes ti ON ti.id = b.truck_intake_id
       GROUP BY ti.id, ti.truck_number, ti.driver_name, ti.status, ti.verified_at, ti.intake_at, ti.created_at

       UNION ALL

       -- 2. Truck Returns (Strictly grouped by return truck ID)
       SELECT 
         'truck_return_' || ret.id::text AS id,
         'return' AS type,
         'Truck Returned to Fleet' AS type_label,
         COUNT(DISTINCT b.id)::text || ' batteries returned on Truck ' || COALESCE(ret.truck_number, '#' || ret.id::text) || COALESCE(' (Driver: ' || ret.driver_name || ')', '') AS details,
         COUNT(DISTINCT b.id)::int AS battery_count,
         'Return Truck ' || COALESCE(ret.truck_number, '#' || ret.id::text) AS reference,
         ret.truck_number AS vehicle_number,
         ret.driver_name,
         NULL AS staff_name,
         NULL::numeric AS amount,
         (ret.verified_at IS NOT NULL) AS verified_by_client,
         COALESCE(ret.returned_at, ret.created_at) AS timestamp,
         jsonb_agg(
           jsonb_build_object(
             'id', b.id,
             'code', b.battery_code,
             'serial', b.serial_number,
             'status', b.status
           ) ORDER BY b.battery_code
         ) AS batteries_list
       FROM client_battery_ids b
       JOIN return_batteries rb ON rb.battery_id = b.id
       JOIN returns ret ON ret.id = rb.return_id
       GROUP BY ret.id, ret.truck_number, ret.driver_name, ret.status, ret.verified_at, ret.returned_at, ret.created_at
     )
     SELECT * FROM events
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows;
}

// Summary stats for the client history overview
async function getHistorySummary(clientId, clientName) {
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE}
     SELECT
       (SELECT COUNT(DISTINCT ti.id) FROM truck_intakes ti JOIN client_battery_ids b ON b.truck_intake_id = ti.id WHERE ti.status = 'pending_arrival' AND ti.verified_at IS NULL)::int AS packed_count,
       (SELECT COUNT(DISTINCT ti.id) FROM truck_intakes ti JOIN client_battery_ids b ON b.truck_intake_id = ti.id WHERE ti.verified_at IS NOT NULL OR ti.status = 'verified')::int AS intake_count,
       (SELECT COUNT(DISTINCT ret.id) FROM returns ret JOIN return_batteries rb ON rb.return_id = ret.id JOIN client_battery_ids b ON b.id = rb.battery_id)::int AS return_count
    `,
    [clientId, clientName]
  );
  const data = rows[0] || {};
  const total_events =
    (data.packed_count || 0) +
    (data.intake_count || 0) +
    (data.return_count || 0);

  return {
    ...data,
    total_events,
  };
}

// Record client truck intake (dispatch from client fleet to Refurbnics workshop)
async function recordClientTruckIntake(clientId, clientName, { truckNumber, driverName, batteryCount, batteryCodes = [], issueDescription }) {
  const truck = (truckNumber || '').trim() || 'N/A';
  const driver = (driverName || '').trim() || 'Fleet Driver';
  const rawCount = Number(batteryCount);
  const items = Array.isArray(batteryCodes)
    ? batteryCodes
        .map((c) => (typeof c === 'string' ? { code: c.trim().toUpperCase() } : { code: (c.code || c.batteryCode || '').trim().toUpperCase() }))
        .filter((c) => c.code)
    : [];

  const count = rawCount > 0 ? rawCount : items.length > 0 ? items.length : 1;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create truck intake record with status 'pending_arrival'
    const { rows: newIntakeRows } = await client.query(
      `INSERT INTO truck_intakes (truck_number, driver_name, client_id, battery_count, status, intake_at, created_at)
       VALUES ($1, $2, $3, $4, 'pending_arrival', now(), now())
       RETURNING *`,
      [truck, driver || 'Client Fleet Driver', clientId, count]
    );
    const intake = newIntakeRows[0];

    const processedBatteries = [];
    for (const item of items) {
      const { rows: existingRows } = await client.query(
        `SELECT * FROM batteries WHERE upper(battery_code) = upper($1) OR (serial_number IS NOT NULL AND upper(serial_number) = upper($1))`,
        [item.code]
      );
      if (existingRows.length > 0) {
        const b = existingRows[0];
        const { rows: updated } = await client.query(
          `UPDATE batteries
           SET status = 'in_repair',
               client_name = COALESCE(client_name, $2),
               truck_intake_id = $3,
               notes = CASE WHEN $4::text IS NOT NULL THEN COALESCE(notes || E'\n' || $4::text, $4::text) ELSE notes END
           WHERE id = $1
           RETURNING *`,
          [b.id, clientName, intake.id, issueDescription ? `[Client Truck Intake ${truck}]: ${issueDescription}` : null]
        );
        processedBatteries.push(updated[0]);
      } else {
        const { rows: created } = await client.query(
          `INSERT INTO batteries (battery_code, client_name, truck_intake_id, status, notes, created_at)
           VALUES ($1, $2, $3, 'in_repair', $4, now())
           RETURNING *`,
          [item.code, clientName, intake.id, issueDescription ? `[Client Truck Intake ${truck}]: ${issueDescription}` : null]
        );
        processedBatteries.push(created[0]);
      }
    }

    await client.query('COMMIT');

    return {
      intake,
      batteries: processedBatteries,
      count,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// The one rule for "may this client touch this truck intake": the intake is
// tagged with their client_id, OR it is an untagged (client_id IS NULL)
// intake whose batteries ALL belong to them — at least one carries their
// name and none carries another client's. Requiring only one matching
// battery would let a client claim or delete a mixed workshop-created
// intake and wipe another company's shipment. `runner` is db or an open
// transaction client so callers inside BEGIN/COMMIT see their own writes.
async function findOwnedIntake(runner, intakeId, clientId, clientName) {
  const { rows } = await runner.query(
    `SELECT ti.* FROM truck_intakes ti
     WHERE ti.id = $1 AND (
       ti.client_id = $2
       OR (
         ti.client_id IS NULL
         AND $3 <> ''
         AND EXISTS (
           SELECT 1 FROM batteries b
           WHERE b.truck_intake_id = ti.id AND lower(b.client_name) = lower($3)
         )
         AND NOT EXISTS (
           SELECT 1 FROM batteries b
           WHERE b.truck_intake_id = ti.id
             AND b.client_name IS NOT NULL AND lower(b.client_name) <> lower($3)
         )
       )
     )`,
    [intakeId, clientId, clientName || '']
  );
  return rows;
}

// Update client's unverified truck intake info (truck number, driver name)
async function updateClientTruckIntake(clientId, clientName, intakeId, { truckNumber, driverName }) {
  const existing = await findOwnedIntake(db, intakeId, clientId, clientName);
  let intakeRecord = existing[0];
  if (!intakeRecord) {
    const { rows: tiFallback } = await db.query(
      `SELECT ti.* FROM truck_intakes ti WHERE ti.id = $1 AND (ti.client_id = $2 OR ti.client_id IS NULL)`,
      [intakeId, clientId]
    );
    if (tiFallback.length === 0) {
      const err = new Error('Truck intake not found or does not belong to your company.');
      err.status = 404;
      throw err;
    }
    intakeRecord = tiFallback[0];
  }
  if (intakeRecord.status === 'verified' || intakeRecord.verified_at) {
    const err = new Error('Cannot edit an intake batch that has already been verified by the workshop.');
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE truck_intakes
     SET truck_number = COALESCE(NULLIF(trim($1), ''), truck_number),
         driver_name = COALESCE(NULLIF(trim($2), ''), driver_name),
         client_id = COALESCE(client_id, $4)
     WHERE id = $3
     RETURNING *`,
    [truckNumber, driverName, intakeId, clientId]
  );
  return rows[0];
}

// Add more batteries to an existing unverified truck intake
async function addBatteriesToClientTruckIntake(clientId, clientName, intakeId, { batteries = [] }) {
  const existing = await findOwnedIntake(db, intakeId, clientId, clientName);
  let intakeRecord = existing[0];
  if (!intakeRecord) {
    const { rows: tiFallback } = await db.query(
      `SELECT ti.* FROM truck_intakes ti WHERE ti.id = $1 AND (ti.client_id = $2 OR ti.client_id IS NULL)`,
      [intakeId, clientId]
    );
    if (tiFallback.length === 0) {
      const err = new Error('Truck intake not found or does not belong to your company.');
      err.status = 404;
      throw err;
    }
    intakeRecord = tiFallback[0];
  }
  if (intakeRecord.status === 'verified' || intakeRecord.verified_at) {
    const err = new Error('Cannot add batteries to a batch that has already been verified by the workshop.');
    err.status = 400;
    throw err;
  }

  const items = Array.isArray(batteries)
    ? batteries
        .map((c) => (typeof c === 'string' ? { code: c.trim().toUpperCase() } : { code: (c.batteryCode || c.code || '').trim().toUpperCase(), serial: (c.serialNumber || c.serial || '').trim(), issue: (c.issueDescription || c.issue || '').trim() }))
        .filter((c) => c.code)
    : [];

  if (items.length === 0) {
    throw new Error('Please specify at least one battery code.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const processed = [];

    for (const item of items) {
      let { rows: existingRows } = await client.query(
        `SELECT * FROM batteries WHERE upper(battery_code) = upper($1) OR (serial_number IS NOT NULL AND upper(serial_number) = upper($1))`,
        [item.code]
      );
      if (existingRows.length > 0) {
        const b = existingRows[0];
        const { rows: updated } = await client.query(
          `UPDATE batteries
           SET status = 'in_repair',
               client_name = COALESCE(client_name, $2),
               serial_number = COALESCE(NULLIF($3::text, ''), serial_number),
               serial_number_added_by_role = CASE WHEN NULLIF($3::text, '') IS NOT NULL THEN 'client' ELSE serial_number_added_by_role END,
               truck_intake_id = $4,
               notes = CASE WHEN NULLIF($5::text, '') IS NOT NULL THEN COALESCE(notes || E'\n' || $5::text, $5::text) ELSE notes END
           WHERE id = $1
           RETURNING *`,
          [b.id, clientName, item.serial, intakeId, item.issue ? `[Packed for Repair]: ${item.issue}` : null]
        );
        processed.push(updated[0]);
      } else {
        const { rows: created } = await client.query(
          `INSERT INTO batteries (battery_code, client_name, serial_number, serial_number_added_by_role, truck_intake_id, status, notes, created_at)
           VALUES ($1, $2, NULLIF($3::text, ''), CASE WHEN NULLIF($3::text, '') IS NOT NULL THEN 'client' ELSE NULL END, $4, 'in_repair', $5::text, now())
           RETURNING *`,
          [item.code, clientName, item.serial, intakeId, item.issue ? `[Packed for Repair]: ${item.issue}` : null]
        );
        processed.push(created[0]);
      }
    }

    // Update battery_count on truck_intake
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM batteries WHERE truck_intake_id = $1`,
      [intakeId]
    );
    await client.query(
      `UPDATE truck_intakes SET battery_count = $1, client_id = COALESCE(client_id, $3) WHERE id = $2`,
      [countRows[0].count, intakeId, clientId]
    );

    await client.query('COMMIT');
    return { added: processed, count: countRows[0].count };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Remove a single battery from an unverified truck intake and reset to returned
async function removeBatteryFromClientTruckIntake(clientId, clientName, intakeId, batteryId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify battery belongs to client (supports both numeric ID and battery_code)
    let { rows: bRows } = await client.query(
      `WITH ${CLIENT_BATTERY_IDS_CTE}
       SELECT b.* FROM client_battery_ids cb JOIN batteries b ON b.id = cb.id
       WHERE b.id::text = $3::text OR upper(b.battery_code) = upper($3::text)`,
      [clientId, clientName, String(batteryId)]
    );
    if (bRows.length === 0) {
      const { rows: directRows } = await client.query(
        `SELECT b.* FROM batteries b
         WHERE (b.id::text = $1::text OR upper(b.battery_code) = upper($1::text))
           AND (lower(b.client_name) = lower($2) OR EXISTS (
             SELECT 1 FROM truck_intakes ti WHERE ti.id = b.truck_intake_id AND ti.client_id = $3
           ))`,
        [String(batteryId), clientName || '', clientId]
      );
      if (directRows.length === 0) {
        const err = new Error('Battery not found or does not belong to your fleet.');
        err.status = 404;
        throw err;
      }
      bRows = directRows;
    }

    const targetBattery = bRows[0];
    const actualBatteryId = targetBattery.id;

    const effectiveIntakeId = (intakeId && intakeId !== 'null' && intakeId !== 'awaiting_pickup' && !isNaN(Number(intakeId)))
      ? Number(intakeId)
      : targetBattery.truck_intake_id;

    if (effectiveIntakeId) {
      const intakeRows = await findOwnedIntake(client, effectiveIntakeId, clientId, clientName);
      let intakeRecord = intakeRows[0];
      if (!intakeRecord) {
        const { rows: tiFallback } = await client.query(
          `SELECT ti.* FROM truck_intakes ti WHERE ti.id = $1`,
          [effectiveIntakeId]
        );
        if (tiFallback.length > 0 && tiFallback[0].client_id && tiFallback[0].client_id !== clientId) {
          const err = new Error('Truck intake not found.');
          err.status = 404;
          throw err;
        }
        intakeRecord = tiFallback[0];
      }

      if (intakeRecord && (intakeRecord.status === 'verified' || intakeRecord.verified_at)) {
        const err = new Error('Cannot remove batteries from an intake batch that has already been verified by the workshop.');
        err.status = 400;
        throw err;
      }

      // Remove visit for this intake
      await client.query(
        `DELETE FROM battery_visits WHERE battery_id = $1 AND truck_intake_id = $2`,
        [actualBatteryId, effectiveIntakeId]
      );

      // Recalculate count
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*)::int AS count FROM batteries WHERE truck_intake_id = $1 AND id != $2`,
        [effectiveIntakeId, actualBatteryId]
      );
      await client.query(
        `UPDATE truck_intakes SET battery_count = $1 WHERE id = $2`,
        [countRows[0].count, effectiveIntakeId]
      );
    }

    // Reset status to returned (with client in active fleet) and unlink intake
    const { rows: updated } = await client.query(
      `UPDATE batteries
       SET truck_intake_id = NULL,
           status = 'returned'
       WHERE id = $1
       RETURNING *`,
      [actualBatteryId]
    );

    await client.query('COMMIT');
    return { unlinkedBattery: updated[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Delete / cancel an entire unverified truck intake and reset all its batteries
async function deleteClientTruckIntake(clientId, clientName, intakeId) {
  const intakeRows = await findOwnedIntake(db, intakeId, clientId, clientName);

  if (intakeRows.length === 0) {
    const err = new Error('Truck intake not found or does not belong to your company.');
    err.status = 404;
    throw err;
  }
  if (intakeRows[0].status === 'verified' || intakeRows[0].verified_at) {
    const err = new Error('Cannot delete an intake batch that has already been verified by the workshop.');
    err.status = 400;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Unlink all batteries attached to this intake
    await client.query(
      `UPDATE batteries
       SET truck_intake_id = NULL,
           status = 'returned'
       WHERE truck_intake_id = $1`,
      [intakeId]
    );

    // Delete battery visits for this intake
    await client.query(
      `DELETE FROM battery_visits WHERE truck_intake_id = $1`,
      [intakeId]
    );

    // Delete the intake
    await client.query(
      `DELETE FROM truck_intakes WHERE id = $1`,
      [intakeId]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Update serial number or notes for a client's battery
async function updateClientBattery(clientId, clientName, batteryId, { serialNumber, notes }) {
  const { rows: bRows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE}
     SELECT b.* FROM client_battery_ids b WHERE b.id = $3`,
    [clientId, clientName, batteryId]
  );
  if (bRows.length === 0) {
    const err = new Error('Battery not found or does not belong to your fleet.');
    err.status = 404;
    throw err;
  }

  const existing = bRows[0];
  const fields = [];
  const params = [];

  if (serialNumber !== undefined) {
    params.push(serialNumber ? serialNumber.trim() : null);
    fields.push(`serial_number = $${params.length}`);
    fields.push(`serial_number_added_by_role = 'client'`);
  }

  if (notes !== undefined) {
    params.push(notes ? notes.trim() : null);
    fields.push(`notes = $${params.length}`);
  }

  if (fields.length === 0) {
    return existing;
  }

  params.push(batteryId);
  const { rows } = await db.query(
    `UPDATE batteries
     SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  return rows[0];
}

async function findSortGroups(clientId, userId) {
  let query;
  let params;
  if (clientId && userId) {
    query = `SELECT id, name, batteries, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM client_sort_groups
             WHERE client_id = $1 OR user_id = $2
             ORDER BY created_at DESC`;
    params = [clientId, userId];
  } else if (clientId) {
    query = `SELECT id, name, batteries, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM client_sort_groups
             WHERE client_id = $1
             ORDER BY created_at DESC`;
    params = [clientId];
  } else if (userId) {
    query = `SELECT id, name, batteries, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM client_sort_groups
             WHERE user_id = $1
             ORDER BY created_at DESC`;
    params = [userId];
  } else {
    return [];
  }

  const { rows } = await db.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    batteries: Array.isArray(r.batteries) ? r.batteries : [],
  }));
}

async function replaceSortGroups(clientId, userId, groups) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    if (clientId && userId) {
      await client.query('DELETE FROM client_sort_groups WHERE client_id = $1 OR user_id = $2', [clientId, userId]);
    } else if (clientId) {
      await client.query('DELETE FROM client_sort_groups WHERE client_id = $1', [clientId]);
    } else if (userId) {
      await client.query('DELETE FROM client_sort_groups WHERE user_id = $1', [userId]);
    }

    if (Array.isArray(groups) && groups.length > 0) {
      for (const g of groups) {
        if (!g || !g.id || !g.name) continue;
        const groupBatteries = Array.isArray(g.batteries) ? g.batteries : [];
        await client.query(
          `INSERT INTO client_sort_groups (id, client_id, user_id, name, batteries, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), now())`,
          [
            String(g.id),
            clientId || null,
            userId || null,
            String(g.name).trim(),
            JSON.stringify(groupBatteries),
            g.createdAt || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return findSortGroups(clientId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  findAll,
  findById,
  findByUserId,
  getDashboardStats,
  findMyBatteries,
  findMyTransactions,
  findMyNotifications,
  findMyHistory,
  getHistorySummary,
  packBatteryForRepair,
  recordClientTruckIntake,
  updateClientTruckIntake,
  addBatteriesToClientTruckIntake,
  removeBatteryFromClientTruckIntake,
  deleteClientTruckIntake,
  updateClientBattery,
  findSortGroups,
  replaceSortGroups,
  create,
  update,
  remove,
};

