const db = require('../config/db');

async function create({ truckNumber, driverName, clientId, batteryIds }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO returns (truck_number, driver_name, battery_count, client_id, status)
       VALUES ($1, $2, $3, $4, 'pending_verification') RETURNING *`,
      [truckNumber, driverName, batteryIds.length, clientId || null]
    );
    const returnRecord = rows[0];

    await client.query(
      `INSERT INTO return_batteries (return_id, battery_id)
       SELECT $1::int, unnest($2::int[])`,
      [returnRecord.id, batteryIds]
    );
    await client.query(
      `UPDATE batteries SET status = 'returned' WHERE id = ANY($1::int[])`,
      [batteryIds]
    );

    await client.query('COMMIT');
    return returnRecord;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findAll() {
  const { rows } = await db.query(
    `SELECT r.*, c.name AS client_name
     FROM returns r
     LEFT JOIN clients c ON c.id = r.client_id
     ORDER BY r.returned_at DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT r.*, c.name AS client_name
     FROM returns r
     LEFT JOIN clients c ON c.id = r.client_id
     WHERE r.id = $1`,
    [id]
  );
  return rows[0];
}

// Every battery shipped out on a given return, plus the repair that led to
// it being ready to return (parts changed + when) — same
// last-repair-lateral-join pattern as truck-intake's detail page, just
// scoped to return_batteries instead of battery_visits.
async function findBatteries(returnId) {
  const { rows } = await db.query(
    `SELECT b.id, b.battery_code, b.serial_number, b.status,
            last_repair.repaired_at AS last_repaired_at,
            last_parts.part_names AS last_repaired_parts
     FROM return_batteries rb
     JOIN batteries b ON b.id = rb.battery_id
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
     WHERE rb.return_id = $1
     ORDER BY b.battery_code`,
    [returnId]
  );
  return rows;
}

// truck_number/driver_name/client_id are editable — which batteries were
// returned is not (changing that would need to re-run the status
// transitions; out of scope for a quick correction).
async function update(id, { truckNumber, driverName, clientId }) {
  const { rows } = await db.query(
    `UPDATE returns SET truck_number = $2, driver_name = $3, client_id = $4 WHERE id = $1 RETURNING *`,
    [id, truckNumber, driverName, clientId || null]
  );
  return rows[0];
}

async function verifyReceipt(id, userId) {
  const { rows } = await db.query(
    `UPDATE returns
     SET status = 'verified',
         verified_at = now(),
         verified_by_user_id = $2
     WHERE id = $1
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}

// Undoes the return: every battery that was part of it goes back to
// 'repaired' (never touching one that's since been re-returned some other
// way), then the return_batteries links and the return row are removed.
async function remove(id) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE batteries SET status = 'repaired'
       WHERE status = 'returned'
         AND id IN (SELECT battery_id FROM return_batteries WHERE return_id = $1)`,
      [id]
    );

    await client.query('DELETE FROM return_batteries WHERE return_id = $1', [id]);
    await client.query('DELETE FROM returns WHERE id = $1', [id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findAll, findById, findBatteries, update, verifyReceipt, remove };
