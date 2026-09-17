const db = require('../config/db');

async function findAll({ activeOnly } = {}) {
  const where = activeOnly ? 'WHERE active = true' : '';
  const { rows } = await db.query(
    `SELECT * FROM services ${where} ORDER BY sort_order ASC, name ASC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM services WHERE id = $1', [id]);
  return rows[0];
}

async function findBySortOrder(sortOrder, excludeId) {
  const { rows } = await db.query(
    excludeId
      ? 'SELECT id FROM services WHERE sort_order = $1 AND id <> $2'
      : 'SELECT id FROM services WHERE sort_order = $1',
    excludeId ? [sortOrder, excludeId] : [sortOrder]
  );
  return rows[0];
}

async function create({ name, description, rate, sortOrder, active = true }) {
  const { rows } = await db.query(
    `INSERT INTO services (name, description, rate, sort_order, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING *`,
    [name.trim(), description ? description.trim() : null, Number(rate) || 0, Number(sortOrder) || 0, active !== false]
  );
  return rows[0];
}

async function update(id, { name, description, rate, active, sortOrder }) {
  const { rows } = await db.query(
    `UPDATE services
     SET name = COALESCE($2, name),
         description = $3,
         rate = COALESCE($4, rate),
         active = COALESCE($5, active),
         sort_order = COALESCE($6, sort_order),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      name !== undefined ? name.trim() : null,
      description !== undefined ? (description ? description.trim() : null) : null,
      rate !== undefined ? Number(rate) : null,
      active !== undefined ? Boolean(active) : null,
      sortOrder !== undefined ? Number(sortOrder) : null,
    ]
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM services WHERE id = $1', [id]);
}

// Retrieves all services performed on a specific battery with staff details
async function findBatteryServices(batteryId) {
  const { rows } = await db.query(
    `SELECT bs.id, bs.battery_id, bs.service_id, bs.service_name, bs.rate,
            bs.notes, bs.batch_id, bs.completed_at,
            s.name AS staff_name
     FROM battery_services bs
     LEFT JOIN staff s ON s.id = bs.staff_id
     WHERE bs.battery_id = $1
     ORDER BY bs.completed_at DESC`,
    [batteryId]
  );
  return rows;
}

// Records multiple services performed during battery testing/servicing
async function addBatteryServices(batteryId, serviceIds = [], staffId = null, { notes, batchId } = {}, client = null) {
  if (!serviceIds || serviceIds.length === 0) return [];
  const queryRunner = client || db;

  // Lookup services snapshot
  const { rows: selectedServices } = await queryRunner.query(
    'SELECT id, name, rate FROM services WHERE id = ANY($1::int[])',
    [serviceIds]
  );

  const inserted = [];
  for (const s of selectedServices) {
    const { rows } = await queryRunner.query(
      `INSERT INTO battery_services (battery_id, service_id, service_name, rate, staff_id, notes, batch_id, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING *`,
      [batteryId, s.id, s.name, s.rate, staffId, notes || null, batchId || null]
    );
    inserted.push(rows[0]);
  }
  return inserted;
}

module.exports = {
  findAll,
  findById,
  findBySortOrder,
  create,
  update,
  remove,
  findBatteryServices,
  addBatteryServices,
};
