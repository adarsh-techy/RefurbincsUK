const db = require('../config/db');

const PUBLIC_COLUMNS =
  'id, name, email, role, permissions, must_change_password, active, created_at';

async function findAll({ roles } = {}) {
  if (Array.isArray(roles) && roles.length > 0) {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE role = ANY($1) ORDER BY name`,
      [roles]
    );
    return rows;
  }
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY name`);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function create({ name, email, passwordHash, role, permissions = [], mustChangePassword = false }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, permissions, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role, JSON.stringify(permissions), mustChangePassword]
  );
  return rows[0];
}

async function update(id, { name, email, role, permissions, active }) {
  const { rows } = await db.query(
    `UPDATE users
     SET name = $2, email = $3, role = $4, permissions = $5, active = $6
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, name, email, role, JSON.stringify(permissions || []), active]
  );
  return rows[0];
}

// Sets a new password (technician/client's own action, from the forced
// first-login change screen) and clears the must_change_password flag.
async function updatePassword(id, passwordHash) {
  const { rows } = await db.query(
    `UPDATE users SET password_hash = $2, must_change_password = false
     WHERE id = $1
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, passwordHash]
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = { findAll, findById, findByEmail, create, update, updatePassword, remove };
