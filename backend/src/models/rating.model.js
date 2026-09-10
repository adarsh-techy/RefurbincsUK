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

async function findAll({ clientId, rating, search, limit = 50, offset = 0 }) {
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

  if (search) {
    params.push(`%${search.trim()}%`);
    query += ` AND (br.battery_code ILIKE $${params.length} OR br.custom_feedback ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
  }

  query += ` ORDER BY br.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await db.query(query, params);
  return rows;
}

async function getStats(clientId = null) {
  let whereClause = '';
  const params = [];
  if (clientId) {
    params.push(clientId);
    whereClause = 'WHERE client_id = $1';
  }

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
     ${whereClause}`,
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
  getStats,
  findByClient,
};
