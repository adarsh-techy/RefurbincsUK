const db = require('../config/db');

async function create({ batteryId, staffId, partId, quantityUsed, notes, laborCharge, batchId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Guard against overselling stock: only deduct if enough is on hand.
    const partResult = await client.query(
      'UPDATE parts SET quantity = quantity - $2 WHERE id = $1 AND quantity >= $2 RETURNING *',
      [partId, quantityUsed]
    );
    if (partResult.rowCount === 0) {
      const err = new Error('Not enough stock for this part');
      err.status = 400;
      throw err;
    }

    // Snapshot the charge at today's service charge, so it stays accurate
    // on past invoices even if the part's price changes later. Per-unit
    // "Price" was retired from the Add Part form — Service Charge is now
    // the only per-part charge an admin sets.
    const price = quantityUsed * Number(partResult.rows[0].service_charge || 0);

    // A multi-part visit calls create() once per part with the same
    // batchId. Only the FIRST call can read work_started_at (the second
    // call below clears it so it doesn't bleed into the next repair cycle)
    // — so later parts in the same batch reuse the first part's already-
    // computed duration instead of recomputing from a now-cleared value.
    const { rows: existingBatchRows } = await client.query(
      'SELECT duration_seconds FROM repairs WHERE batch_id = $1 LIMIT 1',
      [batchId]
    );
    const isFirstInBatch = existingBatchRows.length === 0;

    let durationSeconds;
    if (isFirstInBatch) {
      const { rows: batteryRows } = await client.query(
        'SELECT work_started_at FROM batteries WHERE id = $1',
        [batteryId]
      );
      const workStartedAt = batteryRows[0]?.work_started_at;
      durationSeconds = workStartedAt
        ? Math.round((Date.now() - new Date(workStartedAt).getTime()) / 1000)
        : null;
    } else {
      durationSeconds = existingBatchRows[0].duration_seconds;
    }

    const { rows } = await client.query(
      `INSERT INTO repairs (battery_id, staff_id, part_id, quantity_used, notes, price, labor_charge, batch_id, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [batteryId, staffId, partId, quantityUsed, notes, price, laborCharge || 0, batchId, durationSeconds]
    );

    // Sends the battery to testing rather than straight to repaired — every
    // repair now needs an explicit "mark completed" after verification (see
    // battery.model.js completeTesting). Clears work_started_at so it
    // doesn't bleed into the next repair cycle; testing_started_at begins
    // the next stage's own timer. Only needed once per batch — later parts
    // in the same visit find the battery already in_testing.
    if (isFirstInBatch) {
      await client.query(
        "UPDATE batteries SET status = 'in_testing', work_started_at = NULL, testing_started_at = NULL WHERE id = $1",
        [batteryId]
      );
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Paginated for infinite scroll: ?limit=15&offset=0. ?date=YYYY-MM-DD narrows
// to repairs logged that day. ?q= matches battery code, staff name, or part
// name (partial, case-insensitive). Rows are grouped by batch_id — every
// part logged together in one Log Repair submission shares a batch, so they
// come back as a single row (comma-joined part names, summed price) instead
// of one row per part. `repair_ids` carries every underlying repair id in
// the batch, since edit/delete act on all of them together.
async function findPage({ limit, offset, date, q }) {
  const conditions = [];
  const params = [];

  // Retain all repair history all time — do not exclude unserviceable or recycled batteries.

  if (date) {
    params.push(date);
    conditions.push(`r.repaired_at::date = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(b.battery_code ILIKE $${params.length} OR s.name ILIKE $${params.length} OR p.name ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1, offset);

  const { rows } = await db.query(
    `SELECT
       MIN(r.id) AS id,
       array_agg(r.id ORDER BY r.id) AS repair_ids,
       r.batch_id,
       MAX(b.battery_code) AS battery_code,
       MAX(b.status) AS battery_status,
       MAX(s.name) AS staff_name,
       string_agg(p.name, ', ' ORDER BY p.name) AS part_name,
       SUM(r.price + r.labor_charge) AS price,
       MIN(r.notes) AS notes,
       MIN(r.repaired_at) AS repaired_at,
       MIN(r.duration_seconds) AS duration_seconds
     FROM repairs r
     JOIN batteries b ON b.id = r.battery_id
     JOIN staff s ON s.id = r.staff_id
     JOIN parts p ON p.id = r.part_id
     ${whereClause}
     GROUP BY r.batch_id
     ORDER BY MIN(r.repaired_at) DESC, MIN(r.id) DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), hasMore };
}

// Only quantity/notes are editable — battery/staff/part stay fixed since
// changing them would really be a different repair. Adjusts part stock by
// the delta between the old and new quantity (transactionally, so a partial
// update can never leave stock and the repair record out of sync).
async function update(id, { quantityUsed, notes }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existingRows } = await client.query(
      'SELECT * FROM repairs WHERE id = $1 FOR UPDATE',
      [id]
    );
    const existing = existingRows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return null;
    }

    const delta = quantityUsed - existing.quantity_used;
    if (delta !== 0) {
      const partResult = await client.query(
        'UPDATE parts SET quantity = quantity - $2 WHERE id = $1 AND quantity >= $2 RETURNING *',
        [existing.part_id, delta]
      );
      if (partResult.rowCount === 0) {
        await client.query('ROLLBACK');
        const err = new Error('Not enough stock to increase this repair by that amount');
        err.status = 400;
        throw err;
      }
    }

    // Re-snapshot the charge at today's service charge, in case it's
    // changed since this repair was first logged.
    const { rows: partRows } = await client.query('SELECT service_charge FROM parts WHERE id = $1', [
      existing.part_id,
    ]);
    const price = quantityUsed * Number(partRows[0].service_charge || 0);

    const { rows } = await client.query(
      'UPDATE repairs SET quantity_used = $2, notes = $3, price = $4 WHERE id = $1 RETURNING *',
      [id, quantityUsed, notes, price]
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

// Refunds the stock this repair consumed and deletes it. If it was the
// battery's last remaining repair and the battery is still sitting in
// 'in_testing' or 'repaired' status, reverts it to 'in_repair' — a battery
// that's already been returned is never touched.
async function remove(id) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existingRows } = await client.query('SELECT * FROM repairs WHERE id = $1', [
      id,
    ]);
    const existing = existingRows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return;
    }

    await client.query('UPDATE parts SET quantity = quantity + $2 WHERE id = $1', [
      existing.part_id,
      existing.quantity_used,
    ]);

    await client.query('DELETE FROM repairs WHERE id = $1', [id]);

    const { rows: remainingRows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM repairs WHERE battery_id = $1',
      [existing.battery_id]
    );
    if (remainingRows[0].count === 0) {
      await client.query(
        `UPDATE batteries SET status = 'in_repair', testing_started_at = NULL
         WHERE id = $1 AND status IN ('in_testing', 'repaired')`,
        [existing.battery_id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findPage, update, remove };
