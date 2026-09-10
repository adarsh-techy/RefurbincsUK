const db = require('../config/db');

async function createTicket({
  clientId,
  clientName,
  userId,
  subject,
  category = 'general',
  priority = 'normal',
  batteryCode = null,
  initialMessage,
  senderName,
  senderRole = 'client',
}) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Generate next ticket number
    const { rows: seqRows } = await client.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_number, '^TCK-', ''), '')::int), 1000) + 1 AS next_num
       FROM support_tickets`
    );
    const ticketNumber = `TCK-${seqRows[0].next_num}`;

    const { rows: ticketRows } = await client.query(
      `INSERT INTO support_tickets (
         ticket_number, client_id, client_name, user_id,
         subject, category, priority, status, battery_code, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, now(), now())
       RETURNING *`,
      [
        ticketNumber,
        clientId || null,
        clientName || 'Valued Client',
        userId || null,
        subject.trim(),
        category,
        priority,
        batteryCode ? batteryCode.trim() : null,
      ]
    );

    const ticket = ticketRows[0];

    // Add initial message
    if (initialMessage && initialMessage.trim()) {
      await client.query(
        `INSERT INTO support_ticket_messages (
           ticket_id, sender_id, sender_name, sender_role, message, created_at
         )
         VALUES ($1, $2, $3, $4, $5, now())`,
        [ticket.id, userId || null, senderName || clientName || 'Client', senderRole, initialMessage.trim()]
      );
    }

    await client.query('COMMIT');
    return ticket;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findTickets({
  clientId = null,
  clientName = null,
  status = null,
  category = null,
  search = null,
  limit = 50,
  offset = 0,
} = {}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    params.push(clientId);
    if (clientName) {
      params.push(clientName);
      conditions.push(`(t.client_id = $${params.length - 1} OR lower(t.client_name) = lower($${params.length}))`);
    } else {
      conditions.push(`t.client_id = $${params.length}`);
    }
  } else if (clientName) {
    params.push(clientName);
    conditions.push(`lower(t.client_name) = lower($${params.length})`);
  }

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (category && category !== 'all') {
    params.push(category);
    conditions.push(`t.category = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    conditions.push(
      `(lower(t.ticket_number) LIKE $${params.length} OR lower(t.subject) LIKE $${params.length} OR lower(t.client_name) LIKE $${params.length} OR lower(COALESCE(t.battery_code, '')) LIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;

  const { rows } = await db.query(
    `SELECT 
       t.*,
       COUNT(m.id)::int AS message_count,
       (
         SELECT json_build_object(
           'id', lm.id,
           'sender_name', lm.sender_name,
           'sender_role', lm.sender_role,
           'message', lm.message,
           'created_at', lm.created_at
         )
         FROM support_ticket_messages lm
         WHERE lm.ticket_id = t.id
         ORDER BY lm.created_at DESC
         LIMIT 1
       ) AS last_message
     FROM support_tickets t
     LEFT JOIN support_ticket_messages m ON m.ticket_id = t.id
     ${whereClause}
     GROUP BY t.id
     ORDER BY t.updated_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  return rows;
}

async function findById(ticketId, { clientId = null, clientName = null } = {}) {
  const conditions = ['t.id = $1'];
  const params = [ticketId];

  if (clientId) {
    params.push(clientId);
    if (clientName) {
      params.push(clientName);
      conditions.push(`(t.client_id = $${params.length - 1} OR lower(t.client_name) = lower($${params.length}))`);
    } else {
      conditions.push(`t.client_id = $${params.length}`);
    }
  } else if (clientName) {
    params.push(clientName);
    conditions.push(`lower(t.client_name) = lower($${params.length})`);
  }

  const { rows: ticketRows } = await db.query(
    `SELECT t.*
     FROM support_tickets t
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  const ticket = ticketRows[0];
  if (!ticket) return null;

  const { rows: messages } = await db.query(
    `SELECT id, ticket_id, sender_id, sender_name, sender_role, message, created_at
     FROM support_ticket_messages
     WHERE ticket_id = $1
     ORDER BY created_at ASC`,
    [ticket.id]
  );

  return {
    ...ticket,
    messages,
  };
}

async function addMessage({ ticketId, senderId, senderName, senderRole, message }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: msgRows } = await client.query(
      `INSERT INTO support_ticket_messages (
         ticket_id, sender_id, sender_name, sender_role, message, created_at
       )
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [ticketId, senderId || null, senderName || 'User', senderRole, message.trim()]
    );

    // Update ticket updated_at
    const { rows: ticketRows } = await client.query(
      `UPDATE support_tickets
       SET updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [ticketId]
    );

    await client.query('COMMIT');
    return {
      message: msgRows[0],
      ticket: ticketRows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(ticketId, status) {
  const { rows } = await db.query(
    `UPDATE support_tickets
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [ticketId, status]
  );
  return rows[0];
}

async function getStats({ clientId = null, clientName = null } = {}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    params.push(clientId);
    if (clientName) {
      params.push(clientName);
      conditions.push(`(client_id = $${params.length - 1} OR lower(client_name) = lower($${params.length}))`);
    } else {
      conditions.push(`client_id = $${params.length}`);
    }
  } else if (clientName) {
    params.push(clientName);
    conditions.push(`lower(client_name) = lower($${params.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'open')::int AS open,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
       COUNT(*) FILTER (WHERE status != 'closed' AND EXISTS (
         SELECT 1 FROM support_ticket_messages lm 
         WHERE lm.ticket_id = support_tickets.id 
           AND lm.sender_role IN ('admin', 'super_admin', 'staff')
           AND lm.id = (SELECT max(id) FROM support_ticket_messages WHERE ticket_id = support_tickets.id)
       ))::int AS client_unread,
       COUNT(*) FILTER (WHERE status != 'closed' AND (
         NOT EXISTS (SELECT 1 FROM support_ticket_messages WHERE ticket_id = support_tickets.id)
         OR EXISTS (
           SELECT 1 FROM support_ticket_messages lm 
           WHERE lm.ticket_id = support_tickets.id 
             AND lm.sender_role IN ('client', 'recycle_client')
             AND lm.id = (SELECT max(id) FROM support_ticket_messages WHERE ticket_id = support_tickets.id)
         )
       ))::int AS admin_unread
     FROM support_tickets
     ${whereClause}`,
    params
  );

  return rows[0] || { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, client_unread: 0, admin_unread: 0 };
}

module.exports = {
  createTicket,
  findTickets,
  findById,
  addMessage,
  updateStatus,
  getStats,
};
