const db = require('../config/db');

// activeOnly narrows to reasons currently offered — used by the mobile
// Report Issue picker; the admin management page wants every reason,
// including disabled ones, so it can still edit/re-enable them.
async function findAll({ activeOnly } = {}) {
  const where = activeOnly ? 'WHERE active = true' : '';
  const { rows } = await db.query(
    `SELECT * FROM issue_reasons ${where} ORDER BY sort_order, label`
  );
  return rows;
}

// Whether another reason already occupies this sort order — excludeId skips
// the row being edited so saving it unchanged doesn't flag itself.
async function findBySortOrder(sortOrder, excludeId) {
  const { rows } = await db.query(
    excludeId
      ? 'SELECT id FROM issue_reasons WHERE sort_order = $1 AND id <> $2'
      : 'SELECT id FROM issue_reasons WHERE sort_order = $1',
    excludeId ? [sortOrder, excludeId] : [sortOrder]
  );
  return rows[0];
}

async function create({ label, sortOrder }) {
  const { rows } = await db.query(
    `INSERT INTO issue_reasons (label, sort_order) VALUES ($1, $2) RETURNING *`,
    [label, sortOrder || 0]
  );
  return rows[0];
}

async function update(id, { label, active, sortOrder }) {
  const { rows } = await db.query(
    `UPDATE issue_reasons SET label = $2, active = $3, sort_order = $4 WHERE id = $1 RETURNING *`,
    [id, label, active, sortOrder || 0]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM issue_reasons WHERE id = $1', [id]);
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM issue_reasons WHERE id = $1', [id]);
}

module.exports = { findAll, findById, findBySortOrder, create, update, remove };
