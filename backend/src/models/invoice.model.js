const db = require('../config/db');

async function findAll({ clientId, status, search, date } = {}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    params.push(Number(clientId));
    conditions.push(`i.client_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }

  if (date) {
    params.push(date);
    conditions.push(`i.issue_date = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(i.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR i.notes ILIKE $${params.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT i.*, c.name AS client_name, uc.email AS client_email, u.name AS created_by_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     LEFT JOIN users uc ON uc.id = c.user_id
     LEFT JOIN users u ON u.id = i.created_by_user_id
     ${whereClause}
     ORDER BY i.issue_date DESC, i.id DESC`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT i.*, c.name AS client_name, uc.email AS client_email, u.name AS created_by_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     LEFT JOIN users uc ON uc.id = c.user_id
     LEFT JOIN users u ON u.id = i.created_by_user_id
     WHERE i.id = $1`,
    [id]
  );
  return rows[0];
}

async function findByClientId(clientId) {
  const { rows } = await db.query(
    `SELECT i.*, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.client_id = $1
     ORDER BY i.issue_date DESC, i.id DESC`,
    [clientId]
  );
  return rows;
}

async function create({
  clientId,
  invoiceNumber,
  amount,
  currency = 'INR',
  status = 'sent',
  issueDate,
  dueDate,
  notes,
  filePath,
  fileName,
  fileSize,
  createdByUserId,
}) {
  const { rows } = await db.query(
    `INSERT INTO invoices (
      client_id, invoice_number, amount, currency, status,
      issue_date, due_date, notes, file_path, file_name, file_size,
      created_by_user_id, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10, $11, $12, now(), now())
    RETURNING *`,
    [
      clientId,
      invoiceNumber,
      amount,
      currency,
      status,
      issueDate || null,
      dueDate || null,
      notes || null,
      filePath || null,
      fileName || null,
      fileSize || null,
      createdByUserId || null,
    ]
  );
  return rows[0];
}

async function update(id, fields) {
  const updates = [];
  const params = [id];

  const allowed = [
    'client_id',
    'invoice_number',
    'amount',
    'currency',
    'status',
    'issue_date',
    'due_date',
    'notes',
    'file_path',
    'file_name',
    'file_size',
  ];

  for (const [key, val] of Object.entries(fields)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (allowed.includes(snakeKey)) {
      params.push(val);
      updates.push(`${snakeKey} = $${params.length}`);
    }
  }

  if (updates.length === 0) return findById(id);

  updates.push('updated_at = now()');

  const { rows } = await db.query(
    `UPDATE invoices SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0];
}

async function remove(id) {
  const { rows } = await db.query(`DELETE FROM invoices WHERE id = $1 RETURNING *`, [id]);
  return rows[0];
}

module.exports = {
  findAll,
  findById,
  findByClientId,
  create,
  update,
  remove,
};
