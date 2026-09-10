const db = require('../config/db');

async function findAll() {
  const { rows } = await db.query('SELECT * FROM parts ORDER BY name');
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM parts WHERE id = $1', [id]);
  return rows[0];
}

// Every repair that's ever used this part, newest first — for the part
// detail page's usage history, same pattern as staff.model.js's
// findRepairs (which repairs a staff member logged) but filtered the other
// way around (which repairs used this part).
async function findUsageHistory(partId) {
  const { rows } = await db.query(
    `SELECT r.id, r.batch_id, r.quantity_used, r.notes, r.repaired_at, r.price, r.labor_charge,
            r.duration_seconds, b.battery_code, b.status AS battery_status, s.name AS staff_name
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     JOIN staff s ON s.id = r.staff_id
     WHERE r.part_id = $1
     ORDER BY r.repaired_at DESC`,
    [partId]
  );
  return rows;
}

async function create({ name, sku, quantity, repairCost, serviceCharge }) {
  const { rows } = await db.query(
    `INSERT INTO parts (name, sku, quantity, repair_cost, service_charge) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, sku, quantity, repairCost, serviceCharge]
  );
  return rows[0];
}

async function update(id, { name, sku, quantity, repairCost, serviceCharge }) {
  const { rows } = await db.query(
    `UPDATE parts SET name = $2, sku = $3, quantity = $4, repair_cost = $5, service_charge = $6 WHERE id = $1 RETURNING *`,
    [id, name, sku, quantity, repairCost, serviceCharge]
  );
  return rows[0];
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
    `SELECT a.id, a.quantity_added, a.note, a.adjusted_at, u.name AS adjusted_by_name
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
  findUsageHistory,
  create,
  update,
  remove,
  decrementStock,
  addStock,
  findStockHistory,
};
