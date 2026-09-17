const db = require('../config/db');

async function findAll() {
  const { rows } = await db.query(
    `SELECT t.*, c.name AS client_name
     FROM truck_intakes t
     LEFT JOIN clients c ON c.id = t.client_id
     ORDER BY t.intake_at DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT t.*, c.name AS client_name
     FROM truck_intakes t
     LEFT JOIN clients c ON c.id = t.client_id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0];
}

async function create({ truckNumber, driverName, batteryCount, clientId }) {
  const { rows } = await db.query(
    `INSERT INTO truck_intakes (truck_number, driver_name, battery_count, client_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [truckNumber, driverName, batteryCount, clientId || null]
  );
  return rows[0];
}

// truck_number/driver_name/client_id are editable — battery_count stays
// fixed since it's tied to the battery rows already generated at intake time.
async function update(id, { truckNumber, driverName, clientId }) {
  const { rows } = await db.query(
    `UPDATE truck_intakes SET truck_number = $2, driver_name = $3, client_id = $4 WHERE id = $1 RETURNING *`,
    [id, truckNumber, driverName, clientId || null]
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM truck_intakes WHERE id = $1', [id]);
}

async function verifyArrival(id, userId) {
  const { rows } = await db.query(
    `UPDATE truck_intakes
     SET status = 'verified',
         verified_at = now(),
         verified_by_user_id = $2
     WHERE id = $1
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}

async function findPage({ limit = 15, offset = 0, search, date }) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(t.driver_name ILIKE $${params.length} OR t.truck_number ILIKE $${params.length} OR c.name ILIKE $${params.length})`
    );
  }

  if (date) {
    params.push(date);
    conditions.push(`t.intake_at::date = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit + 1);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const { rows } = await db.query(
    `SELECT t.*, c.name AS client_name
     FROM truck_intakes t
     LEFT JOIN clients c ON c.id = t.client_id
     ${whereClause}
     ORDER BY t.intake_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return { data, hasMore };
}

module.exports = { findAll, findPage, findById, create, update, remove, verifyArrival };
