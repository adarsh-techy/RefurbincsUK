const db = require('../config/db');

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
  )
`;

// Battery counts by status plus total repair visits and balance owed
// (price + labor_charge summed across every part logged, same math as the
// "Total Repair Cost" shown on a battery's own detail page) for every
// battery belonging to this client (see CLIENT_BATTERY_IDS_CTE above).
async function getDashboardStats(clientId, clientName) {
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE}
     SELECT
       COUNT(DISTINCT b.id) AS battery_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_repair') AS in_repair_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_progress') AS in_progress_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'in_testing') AS in_testing_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'repaired') AS repaired_count,
       COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'returned' AND EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)) AS returned_count,
       COUNT(DISTINCT r.batch_id) AS repair_visit_count,
       COALESCE(SUM(r.price + r.labor_charge), 0) AS balance
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
        params.push(Boolean(active));
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
  pending: ['in_progress', 'in_testing', 'repaired'],
  received: ['returned'],
};

async function findMyBatteries(clientId, clientName, bucket) {
  const statuses = BUCKET_STATUSES[bucket];
  const conditions = [];
  const params = [clientId, clientName];

  if (bucket === 'received') {
    conditions.push(`b.status = 'returned'`);
    conditions.push(`EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)`);
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

// Every repair charge across every battery belonging to this client, one row
// per repair visit (batch_id — the same grouping the Repairs page uses) so a
// multi-part visit reads as one billing line, not several.
async function findMyTransactions(clientId, clientName) {
  const { rows } = await db.query(
    `WITH ${CLIENT_BATTERY_IDS_CTE}
     SELECT
       MIN(r.id) AS id,
       r.batch_id,
       MAX(b.battery_code) AS battery_code,
       string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
       MAX(s.name) AS staff_name,
       SUM(r.price + r.labor_charge) AS amount,
       MIN(r.repaired_at) AS repaired_at
     FROM client_battery_ids cb
     JOIN batteries b ON b.id = cb.id
     JOIN repairs r ON r.battery_id = b.id
     JOIN parts p ON p.id = r.part_id
     JOIN staff s ON s.id = r.staff_id
     GROUP BY r.batch_id
     ORDER BY MIN(r.repaired_at) DESC`,
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
      // Find today's truck intake for this client and truck number, or create one
      const { rows: intakeRows } = await client.query(
        `SELECT id FROM truck_intakes 
         WHERE client_id = $1 AND upper(truck_number) = upper($2) AND intake_at::date = now()::date
         ORDER BY id DESC LIMIT 1`,
        [clientId, truck]
      );

      if (intakeRows.length > 0) {
        intakeId = intakeRows[0].id;
        await client.query(
          `UPDATE truck_intakes SET battery_count = battery_count + $2 WHERE id = $1`,
          [intakeId, items.length]
        );
      } else {
        const { rows: newIntakeRows } = await client.query(
          `INSERT INTO truck_intakes (truck_number, driver_name, client_id, battery_count, status, intake_at, created_at)
           VALUES ($1, $2, $3, $4, 'pending_arrival', now(), now())
           RETURNING id`,
          [truck, driver || 'Driver', clientId, items.length]
        );
        intakeId = newIntakeRows[0].id;
      }
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
        if (intakeId) {
          await client.query(
            `INSERT INTO battery_visits (battery_id, truck_intake_id, created_at)
             VALUES ($1, $2, now())
             ON CONFLICT DO NOTHING`,
            [battery.id, intakeId]
          );
        }
        processed.push(updatedRows[0]);
      } else {
        // Create new battery registered directly under this client and marked in_repair
        const { rows: newRows } = await client.query(
          `INSERT INTO batteries (battery_code, client_name, serial_number, serial_number_added_by_role, truck_intake_id, status, notes, created_at)
           VALUES ($1, $2, $3::text, CASE WHEN $3::text IS NOT NULL THEN 'client' ELSE NULL END, $4::integer, 'in_repair', $5::text, now())
           RETURNING *`,
          [item.code, clientName, item.serial, intakeId, item.issue ? `[Packed for Repair by Client]: ${item.issue}` : null]
        );
        if (intakeId && newRows[0]) {
          await client.query(
            `INSERT INTO battery_visits (battery_id, truck_intake_id, created_at)
             VALUES ($1, $2, now())
             ON CONFLICT DO NOTHING`,
            [newRows[0].id, intakeId]
          );
        }
        processed.push(newRows[0]);
      }
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

// Comprehensive lifecycle history of all battery movements, services, and transactions for the client
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
      lower(coalesce(battery_code, '')) LIKE $${sIdx} OR
      lower(coalesce(serial_number, '')) LIKE $${sIdx} OR
      lower(coalesce(vehicle_number, '')) LIKE $${sIdx} OR
      lower(coalesce(driver_name, '')) LIKE $${sIdx} OR
      lower(coalesce(staff_name, '')) LIKE $${sIdx} OR
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
       -- 1. Packed for Repair (Grouped by Truck / Batch)
       SELECT 
         'packed_' || COALESCE(ti.id::text, 'b_' || (CASE WHEN ti.id IS NULL THEN b.id ELSE 0 END)::text) AS id,
         'packed' AS type,
         'Packed for Repair' AS type_label,
         COUNT(DISTINCT b.id)::text || ' batteries packed for workshop repair' || COALESCE(' on Truck ' || ti.truck_number, '') AS details,
         NULL AS battery_code,
         NULL AS serial_number,
         COUNT(DISTINCT b.id)::int AS battery_count,
         COALESCE('Truck ' || ti.truck_number, 'Packed Batch') AS reference,
         ti.truck_number AS vehicle_number,
         ti.driver_name,
         NULL AS staff_name,
         NULL::numeric AS amount,
         false AS verified_by_client,
         COALESCE(ti.created_at, MIN(b.created_at)) AS timestamp,
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
       LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
       WHERE b.created_at IS NOT NULL
       GROUP BY ti.id, ti.truck_number, ti.driver_name, ti.created_at, (CASE WHEN ti.id IS NULL THEN b.id ELSE 0 END)

       UNION ALL

       -- 2. Workshop Intake Verified (Truck arrived and verified at workshop)
       SELECT 
         'intake_' || ti.id::text AS id,
         'intake' AS type,
         'Workshop Intake' AS type_label,
         COUNT(DISTINCT b.id)::text || ' batteries received & verified at workshop on truck ' || COALESCE(ti.truck_number, '—') AS details,
         NULL AS battery_code,
         NULL AS serial_number,
         COUNT(DISTINCT b.id)::int AS battery_count,
         'Intake #' || ti.id::text AS reference,
         ti.truck_number AS vehicle_number,
         ti.driver_name,
         NULL AS staff_name,
         NULL::numeric AS amount,
         true AS verified_by_client,
         COALESCE(ti.verified_at, ti.created_at) AS timestamp,
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
       WHERE ti.verified_at IS NOT NULL OR ti.status = 'verified'
       GROUP BY ti.id, ti.truck_number, ti.driver_name, ti.verified_at, ti.created_at, ti.status

       UNION ALL

       -- 3. Repairs & Service Completed
       SELECT 
         'repair_' || r.batch_id AS id,
         'repair' AS type,
         'Repair & Service' AS type_label,
         'Completed service on battery ' || MAX(b.battery_code) || COALESCE(' — Replaced: ' || string_agg(DISTINCT p.name, ', '), '') AS details,
         MAX(b.battery_code) AS battery_code,
         MAX(b.serial_number) AS serial_number,
         1 AS battery_count,
         'Batch #' || r.batch_id AS reference,
         NULL AS vehicle_number,
         NULL AS driver_name,
         COALESCE(MAX(s.name), 'Workshop Technician') AS staff_name,
         SUM(r.price + r.labor_charge)::numeric AS amount,
         false AS verified_by_client,
         MIN(r.repaired_at) AS timestamp,
         jsonb_build_array(
           jsonb_build_object(
             'id', MAX(b.id),
             'code', MAX(b.battery_code),
             'serial', MAX(b.serial_number),
             'notes', string_agg(DISTINCT p.name, ', '),
             'status', 'repaired'
           )
         ) AS batteries_list
       FROM client_battery_ids b
       JOIN repairs r ON r.battery_id = b.id
       LEFT JOIN parts p ON p.id = r.part_id
       LEFT JOIN staff s ON s.id = r.staff_id
       GROUP BY r.batch_id

       UNION ALL

       -- 4. Returns & Dispatch to Client (Grouped by Truck Return)
       SELECT 
         'return_' || ret.id::text AS id,
         'return' AS type,
         'Returned to Fleet' AS type_label,
         COUNT(DISTINCT b.id)::text || ' batteries returned & received on truck ' || COALESCE(ret.truck_number, '—') AS details,
         NULL AS battery_code,
         NULL AS serial_number,
         COUNT(DISTINCT b.id)::int AS battery_count,
         'Return #' || ret.id::text AS reference,
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

       UNION ALL

       -- 5. Invoices & Billing
       SELECT 
         'invoice_' || i.id::text AS id,
         'invoice' AS type,
         'Invoice Issued' AS type_label,
         'Official billing invoice ' || i.invoice_number || COALESCE(' (' || i.file_name || ')', '') || COALESCE(' - ' || i.notes, '') AS details,
         NULL AS battery_code,
         NULL AS serial_number,
         1 AS battery_count,
         i.invoice_number AS reference,
         NULL AS vehicle_number,
         NULL AS driver_name,
         u.name AS staff_name,
         i.amount::numeric AS amount,
         false AS verified_by_client,
         COALESCE(i.created_at, i.issue_date::timestamptz) AS timestamp,
         '[]'::jsonb AS batteries_list
       FROM invoices i
       LEFT JOIN users u ON u.id = i.created_by_user_id
       WHERE i.client_id = $1
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
       (SELECT COUNT(*) FROM client_battery_ids)::int AS packed_count,
       (SELECT COUNT(DISTINCT ti.id) FROM truck_intakes ti JOIN client_battery_ids b ON b.truck_intake_id = ti.id WHERE ti.verified_at IS NOT NULL OR ti.status = 'verified')::int AS intake_count,
       (SELECT COUNT(DISTINCT r.batch_id) FROM repairs r JOIN client_battery_ids b ON b.id = r.battery_id)::int AS repair_count,
       (SELECT COUNT(DISTINCT ret.id) FROM returns ret JOIN return_batteries rb ON rb.return_id = ret.id JOIN client_battery_ids b ON b.id = rb.battery_id)::int AS return_count,
       (SELECT COUNT(*) FROM invoices WHERE client_id = $1)::int AS invoice_count,
       0::int AS sort_count
    `,
    [clientId, clientName]
  );
  const data = rows[0] || {};
  const total_events =
    (data.packed_count || 0) +
    (data.intake_count || 0) +
    (data.repair_count || 0) +
    (data.return_count || 0) +
    (data.invoice_count || 0) +
    (data.sort_count || 0);

  return {
    ...data,
    total_events,
  };
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
  create,
  update,
  remove,
};
