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

// ── Restore ──────────────────────────────────────────────────────────────
// Every delete that lands here hard-deletes the original row, keeping a full
// snapshot in item_data. Restore puts that row back (same id when it's still
// free) inside one transaction. Rows deleted alongside it by ON DELETE
// CASCADE (e.g. a client's invoices) are not in the snapshot and can't come
// back — each type lists what isn't restored so the UI can say so.

const RESTORE_TYPES = {
  battery: {
    table: 'batteries',
    label: 'battery',
    notRestored: 'Workshop visit and service records deleted with the battery are not restored.',
    uniques: [
      { columns: ['battery_code'], message: (r) => `Another battery already uses the code ${r.battery_code}.` },
      { columns: ['rfid_tag'], message: (r) => `RFID tag ${r.rfid_tag} is now assigned to another battery.` },
      { columns: ['client_name', 'serial_number'], message: (r) => `Serial number ${r.serial_number} is already used by another ${r.client_name} battery.` },
    ],
  },
  client: {
    table: 'clients',
    label: 'client',
    notRestored: 'Invoices, support tickets, ratings, certificates and sort groups deleted with the client are not restored.',
    uniques: [
      { columns: ['name'], message: (r) => `A client named "${r.name}" already exists.` },
    ],
    // the login survives a client delete; re-link it only if it's still free
    optionalLinks: [{ column: 'user_id', sql: 'SELECT 1 FROM clients WHERE user_id = $1', note: 'The client login is now used by another client, so it was not re-linked.' }],
  },
  staff: {
    table: 'staff',
    label: 'staff member',
    notRestored: null,
    uniques: [],
    optionalLinks: [{ column: 'user_id', sql: 'SELECT 1 FROM staff WHERE user_id = $1', note: 'The staff login is now linked to another staff member, so it was not re-linked.' }],
  },
  part: {
    table: 'parts',
    label: 'part',
    notRestored: 'Stock adjustment history deleted with the part is not restored.',
    uniques: [
      { columns: ['client_id', 'sku'], message: (r) => `This client already has a part with SKU ${r.sku}.` },
    ],
  },
  service: {
    table: 'services',
    label: 'service',
    notRestored: null,
    uniques: [],
    sortOrder: true,
  },
  issue_reason: {
    table: 'issue_reasons',
    label: 'issue reason',
    notRestored: null,
    uniques: [
      { columns: ['label'], message: (r) => `An issue reason "${r.label}" already exists.` },
    ],
    sortOrder: true,
  },
  truck_intake: {
    table: 'truck_intakes',
    label: 'truck intake',
    notRestored: null,
    uniques: [],
  },
};

// Types the trash can hold but never restore, and why (shown in the UI).
const NOT_RESTORABLE = {
  invoice: 'The invoice file was removed from storage when it was deleted, so it can’t be restored. Upload the invoice again instead.',
};

function restoreInfo(itemType) {
  if (RESTORE_TYPES[itemType]) {
    return { restorable: true, restore_blocked_reason: null, restore_note: RESTORE_TYPES[itemType].notRestored };
  }
  return {
    restorable: false,
    restore_blocked_reason: NOT_RESTORABLE[itemType] || 'This kind of item can’t be restored.',
    restore_note: null,
  };
}

function restoreError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function restore(id) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: items } = await client.query('SELECT * FROM trash_items WHERE id = $1 FOR UPDATE', [id]);
    const item = items[0];
    if (!item) throw restoreError(404, 'Trash item not found');
    const cfg = RESTORE_TYPES[item.item_type];
    if (!cfg) throw restoreError(409, restoreInfo(item.item_type).restore_blocked_reason);

    const snapshot = item.item_data || {};
    const notes = [];

    // Only the table's real, writable columns — the snapshot also carries
    // joined display fields (login_email, client_name on intakes, …).
    const { rows: cols } = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'`,
      [cfg.table]
    );
    const row = {};
    cols.forEach((c) => {
      if (Object.prototype.hasOwnProperty.call(snapshot, c.column_name)) {
        const v = snapshot[c.column_name];
        row[c.column_name] = v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v;
      }
    });
    if (row.id === undefined && item.original_id) row.id = item.original_id;
    const types = Object.fromEntries(cols.map((c) => [c.column_name, c.data_type]));

    // Parents that are gone: a required one blocks the restore, an optional
    // one is cleared with a note.
    const { rows: fks } = await client.query(
      `SELECT kcu.column_name, ccu.table_name AS parent_table, ccu.column_name AS parent_column, c.is_nullable
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
         JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = kcu.column_name AND c.table_schema = 'public'
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
      [cfg.table]
    );
    for (const fk of fks) {
      const value = row[fk.column_name];
      if (value === null || value === undefined) continue;
      const { rowCount } = await client.query(
        `SELECT 1 FROM ${fk.parent_table} WHERE ${fk.parent_column} = $1`,
        [value]
      );
      if (rowCount > 0) continue;
      if (fk.is_nullable === 'NO' || (cfg.table === 'truck_intakes' && fk.column_name === 'client_id')) {
        throw restoreError(409, `Can’t restore this ${cfg.label}: the ${fk.parent_table.replace(/_/g, ' ').replace(/s$/, '')} it belonged to no longer exists.`);
      }
      row[fk.column_name] = null;
      if (fk.parent_table === 'truck_intakes') notes.push('Its truck intake no longer exists, so it was restored without one.');
    }

    for (const link of cfg.optionalLinks || []) {
      const value = row[link.column];
      if (value === null || value === undefined) continue;
      const { rowCount } = await client.query(link.sql, [value]);
      if (rowCount > 0) {
        row[link.column] = null;
        notes.push(link.note);
      }
    }

    for (const u of cfg.uniques) {
      if (u.columns.some((c) => row[c] === null || row[c] === undefined || row[c] === '')) continue;
      const where = u.columns.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
      const { rowCount } = await client.query(
        `SELECT 1 FROM ${cfg.table} WHERE ${where}`,
        u.columns.map((c) => row[c])
      );
      if (rowCount > 0) throw restoreError(409, u.message(row));
    }

    // Sort order is unique by app rule, not by the DB: move to the end if taken.
    if (cfg.sortOrder && row.sort_order !== undefined && Number(row.sort_order) !== 0) {
      const { rowCount } = await client.query(`SELECT 1 FROM ${cfg.table} WHERE sort_order = $1`, [row.sort_order]);
      if (rowCount > 0) {
        const { rows: maxRows } = await client.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${cfg.table}`);
        notes.push(`Order ${row.sort_order} is now used by another entry, so it was moved to ${maxRows[0].next}.`);
        row.sort_order = maxRows[0].next;
      }
    }

    // Keep the original id when nobody has taken it since.
    if (row.id !== undefined) {
      const { rowCount } = await client.query(`SELECT 1 FROM ${cfg.table} WHERE id = $1`, [row.id]);
      if (rowCount > 0) delete row.id;
    }

    const names = Object.keys(row);
    const placeholders = names.map((n, i) =>
      types[n] === 'timestamp without time zone' ? `($${i + 1}::timestamptz)::timestamp` : `$${i + 1}`
    );
    const { rows: inserted } = await client.query(
      `INSERT INTO ${cfg.table} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      names.map((n) => row[n])
    );

    await client.query('DELETE FROM trash_items WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { item, record: inserted[0], notes };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw restoreError(409, 'Can’t restore: another record now uses the same unique value.');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  restore,
  restoreInfo,
  record,
  findPage,
  findById,
  getStats,
  remove,
  clearAll,
};
