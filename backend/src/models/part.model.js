const db = require('../config/db');

// Every part carries its owning client (client_id / client_name) and its own
// minimum stock limit; "low" means quantity at or below that limit.
const PART_COLUMNS = `p.*, c.name AS client_name, (p.quantity <= p.min_stock) AS is_low`;

// clientId: only that client's parts. withUnassigned: also parts no client
// owns yet (old stock from before parts were per client).
async function findAll({ clientId, withUnassigned = false } = {}) {
  const params = [];
  let where = '';
  if (clientId) {
    params.push(clientId);
    where = withUnassigned ? 'WHERE (p.client_id = $1 OR p.client_id IS NULL)' : 'WHERE p.client_id = $1';
  }
  const { rows } = await db.query(
    `SELECT ${PART_COLUMNS} FROM parts p LEFT JOIN clients c ON c.id = p.client_id ${where} ORDER BY c.name NULLS FIRST, p.name`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PART_COLUMNS} FROM parts p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = $1`, [id]);
  return rows[0];
}

// The fleet client a battery belongs to (batteries are linked by client name).
async function findClientForBattery(batteryId) {
  const { rows } = await db.query(
    `SELECT c.id, c.name FROM batteries b
       JOIN clients c ON lower(trim(c.name)) = lower(trim(b.client_name))
      WHERE b.id = $1 LIMIT 1`,
    [batteryId]
  );
  return rows[0] || null;
}

// A client's own parts for its portal: stock levels only, no pricing.
async function findForClient(clientId) {
  const { rows } = await db.query(
    `SELECT id, name, sku, quantity, min_stock, (quantity <= min_stock) AS is_low, created_at
       FROM parts WHERE client_id = $1 ORDER BY (quantity <= min_stock) DESC, name`,
    [clientId]
  );
  return rows;
}

// Every repair that's ever used this part, newest first — for the part
// detail page's usage history, same pattern as staff.model.js's
// findRepairs (which repairs a staff member logged) but filtered the other
// way around (which repairs used this part).
async function findUsageHistory(partId) {
  const { rows } = await db.query(
    `SELECT r.id, r.batch_id, r.quantity_used, r.notes, r.repaired_at, r.price, r.labor_charge,
            r.duration_seconds, r.removed_at, r.removed_by_staff_id,
            b.id AS battery_id, b.battery_code, b.serial_number, b.client_name,
            b.status AS battery_status, s.name AS staff_name, s.role AS staff_role,
            rem_s.name AS removed_by_staff_name,
            ti.truck_number
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     JOIN staff s ON s.id = r.staff_id
     LEFT JOIN staff rem_s ON rem_s.id = r.removed_by_staff_id
     LEFT JOIN truck_intakes ti ON ti.id = b.truck_intake_id
     WHERE r.part_id = $1
     ORDER BY r.repaired_at DESC`,
    [partId]
  );
  return rows;
}

async function create({ name, sku, quantity, repairCost, serviceCharge, clientId, minStock }) {
  const { rows } = await db.query(
    `INSERT INTO parts (name, sku, quantity, repair_cost, service_charge, client_id, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, sku, quantity, repairCost, serviceCharge, clientId, minStock]
  );
  return findById(rows[0].id);
}

// clientId / minStock are only changed when given (undefined = keep).
async function update(id, { name, sku, quantity, repairCost, serviceCharge, clientId, minStock }) {
  const { rows } = await db.query(
    `UPDATE parts SET name = $2, sku = $3, quantity = $4, repair_cost = $5, service_charge = $6,
            client_id = CASE WHEN $7::boolean THEN $8::int ELSE client_id END,
            min_stock = COALESCE($9::int, min_stock)
      WHERE id = $1 RETURNING id`,
    [id, name, sku, quantity, repairCost, serviceCharge, clientId !== undefined, clientId ?? null, minStock ?? null]
  );
  return rows[0] ? findById(rows[0].id) : undefined;
}

async function remove(id) {
  await db.query('DELETE FROM parts WHERE id = $1', [id]);
}

async function decrementStock(id, amount, client = db) {
  const { rows } = await client.query(
    'UPDATE parts SET quantity = quantity - $2 WHERE id = $1 RETURNING *',
    [id, amount]
  );
  return rows[0];
}

// Restocks a part (e.g. once it's run out) and logs the top-up in the same
// transaction, so the quantity bump and its audit record can never drift
// apart — mirrors repair.model.js's create() pattern for stock changes.
async function addStock(id, { quantityAdded, note, adjustedByUserId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'UPDATE parts SET quantity = quantity + $2 WHERE id = $1 RETURNING *',
      [id, quantityAdded]
    );
    if (rows.length === 0) {
      const err = new Error('Part not found');
      err.status = 404;
      throw err;
    }

    await client.query(
      `INSERT INTO part_stock_adjustments (part_id, quantity_added, adjusted_by_user_id, note)
       VALUES ($1, $2, $3, $4)`,
      [id, quantityAdded, adjustedByUserId, note || null]
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

// Every manual restock for this part, newest first — for the part detail
// page's restock history and monthly restocked-vs-used breakdown.
async function findStockHistory(partId) {
  const { rows } = await db.query(
    `SELECT a.id, a.quantity_added, a.note, a.adjusted_at, u.name AS adjusted_by_name, u.email AS adjusted_by_email, u.role AS adjusted_by_role
     FROM part_stock_adjustments a
     LEFT JOIN users u ON u.id = a.adjusted_by_user_id
     WHERE a.part_id = $1
     ORDER BY a.adjusted_at DESC`,
    [partId]
  );
  return rows;
}

module.exports = {
  findAll,
  findById,
  findClientForBattery,
  findForClient,
  findUsageHistory,
  create,
  update,
  remove,
  decrementStock,
  addStock,
  findStockHistory,
};
