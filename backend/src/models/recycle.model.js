const db = require('../config/db');

// Same batch-shipment pattern as return.model.js's create: record the
// shipment, link every battery to it, then flip those batteries to their
// terminal 'recycled' status — all inside one transaction.
async function create({ vehicleNumber, driverName, batteryIds, recycleClientId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO recycle_batches (vehicle_number, driver_name, battery_count, recycle_client_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [vehicleNumber, driverName, batteryIds.length, recycleClientId || null]
    );
    const batch = rows[0];

    await client.query(
      `INSERT INTO recycle_batteries (recycle_id, battery_id)
       SELECT $1::int, unnest($2::int[])`,
      [batch.id, batteryIds]
    );
    await client.query(
      `UPDATE batteries SET status = 'recycled' WHERE id = ANY($1::int[])`,
      [batteryIds]
    );

    await client.query('COMMIT');
    return batch;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findAll({ recycleClientId } = {}) {
  if (recycleClientId) {
    const { rows } = await db.query(
      `SELECT rb.*, c.name AS recycle_client_name
       FROM recycle_batches rb
       LEFT JOIN clients c ON c.id = rb.recycle_client_id
       WHERE rb.recycle_client_id = $1
       ORDER BY rb.recycled_at DESC`,
      [recycleClientId]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT rb.*, c.name AS recycle_client_name
     FROM recycle_batches rb
     LEFT JOIN clients c ON c.id = rb.recycle_client_id
     ORDER BY rb.recycled_at DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM recycle_batches WHERE id = $1', [id]);
  return rows[0];
}

// Every battery sent out on a given recycle shipment, plus which client it
// originally belonged to and why it was declared unserviceable.
async function findBatteries(recycleId) {
  const { rows } = await db.query(
    `SELECT b.id, b.battery_code, b.status, b.client_name,
            last_issue.reason AS issue_reason,
            last_issue.reported_at AS issue_reported_at
     FROM recycle_batteries rb
     JOIN batteries b ON b.id = rb.battery_id
     LEFT JOIN LATERAL (
       SELECT ir.label AS reason, bi.reported_at
       FROM battery_issues bi
       JOIN issue_reasons ir ON ir.id = bi.reason_id
       WHERE bi.battery_id = b.id
       ORDER BY bi.reported_at DESC
       LIMIT 1
     ) last_issue ON true
     WHERE rb.recycle_id = $1
     ORDER BY b.battery_code`,
    [recycleId]
  );
  return rows;
}

// Which recycle shipment (if any) a given battery went out on — for the
// Battery Detail page, so a recycled battery shows the vehicle/driver/date
// it left on instead of just the terminal 'recycled' status.
async function findByBatteryId(batteryId) {
  const { rows } = await db.query(
    `SELECT rb.*
     FROM recycle_batches rb
     JOIN recycle_batteries link ON link.recycle_id = rb.id
     WHERE link.battery_id = $1
     ORDER BY rb.recycled_at DESC
     LIMIT 1`,
    [batteryId]
  );
  return rows[0];
}

// vehicle_number/driver_name are editable — which batteries were recycled is
// not (delete + re-record if that needs to change).
async function update(id, { vehicleNumber, driverName }) {
  const { rows } = await db.query(
    `UPDATE recycle_batches SET vehicle_number = $2, driver_name = $3 WHERE id = $1 RETURNING *`,
    [id, vehicleNumber, driverName]
  );
  return rows[0];
}

// Undoes the shipment: every battery that was part of it goes back to
// 'unserviceable' (never touching one that's since been re-recycled some
// other way), then the recycle_batteries links and the batch row are removed.
async function remove(id) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE batteries SET status = 'unserviceable'
       WHERE status = 'recycled'
         AND id IN (SELECT battery_id FROM recycle_batteries WHERE recycle_id = $1)`,
      [id]
    );

    await client.query('DELETE FROM recycle_batteries WHERE recycle_id = $1', [id]);
    await client.query('DELETE FROM recycle_batches WHERE id = $1', [id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Summary stats for a recycle_client's dashboard.
async function getClientDashboard(recycleClientId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int AS shipment_count,
       COALESCE(SUM(battery_count), 0)::int AS total_batteries,
       MAX(recycled_at) AS latest_shipment_at
     FROM recycle_batches
     WHERE recycle_client_id = $1`,
    [recycleClientId]
  );
  const recent = await findAll({ recycleClientId });
  return { stats: rows[0], recentShipments: recent.slice(0, 10) };
}

module.exports = { create, findAll, findById, findBatteries, findByBatteryId, update, remove, getClientDashboard };
