const db = require('../config/db');

async function create({ clientId, clientUserId, batteryId, batteryCode, returnId, rating, presetTags = [], customFeedback }) {
  const { rows } = await db.query(
    `INSERT INTO battery_ratings 
     (client_id, client_user_id, battery_id, battery_code, return_id, rating, preset_tags, custom_feedback)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      clientId || null,
      clientUserId || null,
      batteryId || null,
      batteryCode ? batteryCode.toUpperCase().trim() : null,
      returnId || null,
      rating,
      JSON.stringify(presetTags || []),
      customFeedback ? customFeedback.trim() : null,
    ]
  );
  return rows[0];
}

async function findAll({ clientId, rating, search, startDate, endDate, limit = 50, offset = 0 }) {
  let query = `
    SELECT 
      br.*,
      c.name AS client_name,
      c.logo_path AS client_logo_path,
      u.email AS user_email,
      u.name AS user_name
    FROM battery_ratings br
    LEFT JOIN clients c ON c.id = br.client_id
    LEFT JOIN users u ON u.id = br.client_user_id
    WHERE 1=1
  `;
  const params = [];

  if (clientId) {
    params.push(clientId);
    query += ` AND br.client_id = $${params.length}`;
  }

  if (rating) {
    params.push(rating);
    query += ` AND br.rating = $${params.length}`;
  }

  if (startDate) {
    params.push(startDate);
    query += ` AND br.created_at >= $${params.length}::timestamptz`;
  }

  if (endDate) {
    params.push(endDate);
    query += ` AND br.created_at <= $${params.length}::timestamptz`;
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    query += ` AND (br.battery_code ILIKE $${params.length} OR br.custom_feedback ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
  }

  query += ` ORDER BY br.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await db.query(query, params);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT 
      br.*,
      COALESCE(c.name, br.battery_code) AS client_name,
      c.logo_path AS client_logo_path,
      c.invoice_email AS client_invoice_email,
      u.email AS user_email,
      u.name AS user_name,
      b.id AS battery_id,
      b.battery_code AS resolved_battery_code,
      b.serial_number AS battery_serial_number,
      b.status AS battery_current_status,
      b.created_at AS battery_created_at
    FROM battery_ratings br
    LEFT JOIN clients c ON c.id = br.client_id
    LEFT JOIN users u ON u.id = br.client_user_id
    LEFT JOIN batteries b ON b.id = br.battery_id OR (br.battery_code IS NOT NULL AND lower(b.battery_code) = lower(br.battery_code))
    WHERE br.id = $1`,
    [id]
  );
  if (!rows[0]) return null;

  const ratingRecord = rows[0];

  // Optionally fetch latest repairs on this battery
  if (ratingRecord.battery_id) {
    const { rows: repairs } = await db.query(
      `SELECT
         MIN(r.id) AS id,
         r.batch_id,
         string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
         MAX(s.name) AS staff_name,
         MIN(r.repaired_at) AS repaired_at,
         MIN(r.notes) AS notes
       FROM repairs r
       JOIN parts p ON p.id = r.part_id
       LEFT JOIN staff s ON s.id = r.staff_id
       WHERE r.battery_id = $1
       GROUP BY r.batch_id
       ORDER BY MIN(r.repaired_at) DESC
       LIMIT 5`,
      [ratingRecord.battery_id]
    );
    ratingRecord.recent_repairs = repairs;
  } else {
    ratingRecord.recent_repairs = [];
  }

  return ratingRecord;
}

async function getStats({ clientId = null, startDate = null, endDate = null } = {}) {
  const whereClauses = [];
  const params = [];

  if (clientId) {
    params.push(clientId);
    whereClauses.push(`client_id = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    whereClauses.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate);
    whereClauses.push(`created_at <= $${params.length}::timestamptz`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT 
      COUNT(*) AS total_reviews,
      COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS average_rating,
      COUNT(*) FILTER (WHERE rating = 5) AS stars_5,
      COUNT(*) FILTER (WHERE rating = 4) AS stars_4,
      COUNT(*) FILTER (WHERE rating = 3) AS stars_3,
      COUNT(*) FILTER (WHERE rating = 2) AS stars_2,
      COUNT(*) FILTER (WHERE rating = 1) AS stars_1,
      COUNT(*) FILTER (WHERE rating >= 4) AS positive_count
     FROM battery_ratings
     ${whereSql}`,
    params
  );

  return rows[0];
}

async function findByClient(clientId, limit = 20) {
  const { rows } = await db.query(
    `SELECT * FROM battery_ratings 
     WHERE client_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [clientId, limit]
  );
  return rows;
}

module.exports = {
  create,
  findAll,
  findById,
  getStats,
  findByClient,
};
