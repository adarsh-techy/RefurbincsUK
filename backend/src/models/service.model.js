const db = require('../config/db');

async function findAll({ activeOnly, isMandatory } = {}) {
  const conditions = [];
  const params = [];

  if (activeOnly) {
    conditions.push('active = true');
  }

  if (isMandatory !== undefined) {
    params.push(Boolean(isMandatory));
    conditions.push(`is_mandatory = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM services ${where} ORDER BY sort_order ASC, name ASC`,
    params
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

async function create({ name, description, rate, sortOrder, active = true, isMandatory = false }) {
  const { rows } = await db.query(
    `INSERT INTO services (name, description, rate, sort_order, active, is_mandatory, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING *`,
    [
      name.trim(),
      description ? description.trim() : null,
      Number(rate) || 0,
      Number(sortOrder) || 0,
      active !== false,
      Boolean(isMandatory),
    ]
  );
  return rows[0];
}

async function update(id, { name, description, rate, active, sortOrder, isMandatory }) {
  const { rows } = await db.query(
    `UPDATE services
     SET name = COALESCE($2, name),
         description = $3,
         rate = COALESCE($4, rate),
         active = COALESCE($5, active),
         sort_order = COALESCE($6, sort_order),
         is_mandatory = COALESCE($7, is_mandatory),
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
      isMandatory !== undefined ? Boolean(isMandatory) : null,
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

// Automatically applies all active mandatory service fees to given battery ID(s)
async function applyMandatoryServicesToBatteries(batteryIds, { queryRunner = null, staffId = null, notes = 'Mandatory Intake Service Fee', batchId = null } = {}) {
  const rawIds = Array.isArray(batteryIds) ? batteryIds : [batteryIds];
  const cleanIds = [...new Set(rawIds.map(Number).filter(Boolean))];
  if (cleanIds.length === 0) return [];

  const runner = queryRunner || db;

  const { rows: inserted } = await runner.query(
    `INSERT INTO battery_services (battery_id, service_id, service_name, rate, staff_id, notes, batch_id, completed_at)
     SELECT b.id, s.id, s.name, s.rate, $2, COALESCE($3, 'Mandatory Intake Service Fee'), $4, now()
     FROM unnest($1::int[]) AS b(id)
     CROSS JOIN services s
     WHERE s.is_mandatory = true AND s.active = true
       AND NOT EXISTS (
         SELECT 1 FROM battery_services bs
         WHERE bs.battery_id = b.id AND bs.service_id = s.id
       )
     RETURNING *`,
    [cleanIds, staffId, notes, batchId]
  );

  return inserted;
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
  applyMandatoryServicesToBatteries,
  addBatteryServices,
};
