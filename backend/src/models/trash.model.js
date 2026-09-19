const db = require('../config/db');

async function record({ originalId, itemType, title, subtitle, itemData, user }) {
  const { rows } = await db.query(
    `INSERT INTO trash_items (
      original_id, item_type, title, subtitle, item_data,
      deleted_by_user_id, deleted_by_name, deleted_by_email, deleted_by_role
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      originalId || null,
      itemType,
      title || 'Untitled Item',
      subtitle || null,
      itemData ? JSON.stringify(itemData) : '{}',
      user?.id || null,
      user?.name || 'System / Admin',
      user?.email || null,
      user?.role || null,
    ]
  );
  return rows[0];
}

async function findPage({ limit = 20, offset = 0, itemType, search, startDate, endDate }) {
  const whereClauses = ['1=1'];
  const params = [];

  if (itemType && itemType !== 'all') {
    params.push(itemType);
    whereClauses.push(`t.item_type = $${params.length}`);
  }

  if (startDate) {
    params.push(startDate);
    whereClauses.push(`t.deleted_at >= $${params.length}::timestamptz`);
  }

  if (endDate) {
    params.push(endDate);
    whereClauses.push(`t.deleted_at <= $${params.length}::timestamptz`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    whereClauses.push(
      `(t.title ILIKE $${params.length} OR t.subtitle ILIKE $${params.length} OR t.deleted_by_name ILIKE $${params.length} OR t.deleted_by_email ILIKE $${params.length} OR t.item_type ILIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM trash_items t WHERE ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const dataQuery = `
    SELECT t.*
    FROM trash_items t
    WHERE ${whereSql}
    ORDER BY t.deleted_at DESC, t.id DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(limit + 1, offset);

  const { rows } = await db.query(dataQuery, params);
  const hasMore = rows.length > limit;

  return {
    rows: rows.slice(0, limit),
    total,
    hasMore,
  };
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT t.*, u.name AS current_user_name, u.email AS current_user_email
     FROM trash_items t
     LEFT JOIN users u ON u.id = t.deleted_by_user_id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getStats() {
  const totalRes = await db.query('SELECT COUNT(*)::int AS total FROM trash_items');
  const typeRes = await db.query(
    'SELECT item_type, COUNT(*)::int AS count FROM trash_items GROUP BY item_type ORDER BY count DESC'
  );

  const byType = {};
  typeRes.rows.forEach((r) => {
    byType[r.item_type] = r.count;
  });

  return {
    total: totalRes.rows[0]?.total || 0,
    byType,
  };
}

async function remove(id) {
  const { rows } = await db.query('DELETE FROM trash_items WHERE id = $1 RETURNING *', [id]);
  return rows[0];
}

async function clearAll() {
  await db.query('DELETE FROM trash_items');
}

module.exports = {
  record,
  findPage,
  findById,
  getStats,
  remove,
  clearAll,
};
