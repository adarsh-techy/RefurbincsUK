// Lists batteries whose client_name matches no client — left behind when a
// client was renamed before renames carried their batteries along — and can
// move one such group onto a client's current name.
//
//   node scripts/check-orphan-batteries.js                          list orphans
//   node scripts/check-orphan-batteries.js --assign "Old Name" 12   dry run: show what would move
//   node scripts/check-orphan-batteries.js --assign "Old Name" 12 --apply
//
// Uses DATABASE_URL / DB_* like the server. --db <name> overrides the local
// database name (development only).
const env = require('../src/config/env');

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
if (flag('--db')) {
  env.db.name = flag('--db');
  env.db.url = undefined;
}
const db = require('../src/config/db');

const assignIdx = argv.indexOf('--assign');
const apply = argv.includes('--apply');

async function listOrphans() {
  const { rows } = await db.query(
    `SELECT b.client_name, COUNT(*)::int AS batteries,
            MIN(b.battery_code) AS first_code, MAX(b.battery_code) AS last_code
       FROM batteries b
      WHERE b.client_name IS NOT NULL AND trim(b.client_name) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM clients c WHERE lower(trim(c.name)) = lower(trim(b.client_name))
        )
      GROUP BY b.client_name
      ORDER BY b.client_name`
  );
  if (!rows.length) {
    console.log('No orphaned batteries — every battery matches a client.');
    return;
  }
  console.log('Batteries whose client name matches no client:\n');
  for (const r of rows) {
    console.log(`  "${r.client_name}"  ${r.batteries} batteries  (${r.first_code} … ${r.last_code})`);
  }
  console.log('\nMove a group with: --assign "<name above>" <clientId> [--apply]');
}

async function assign(oldName, clientId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: target } = await client.query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
    if (!target.length) throw new Error(`No client with id ${clientId}.`);
    const { rows: owner } = await client.query(
      'SELECT id, name FROM clients WHERE lower(trim(name)) = lower(trim($1))',
      [oldName]
    );
    if (owner.length) {
      throw new Error(`"${oldName}" is the current name of client #${owner[0].id} — those batteries aren't orphaned.`);
    }
    const { rows: moved } = await client.query(
      `UPDATE batteries SET client_name = $1
        WHERE lower(trim(client_name)) = lower(trim($2))
        RETURNING battery_code`,
      [target[0].name, oldName]
    );
    if (!moved.length) throw new Error(`No batteries are under the name "${oldName}".`);

    console.log(`${apply ? 'Moved' : 'Would move'} ${moved.length} batteries from "${oldName}" to client #${target[0].id} "${target[0].name}":`);
    console.log(`  ${moved.map((m) => m.battery_code).sort().join(', ')}`);
    if (apply) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDry run — nothing changed. Add --apply to save.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  if (assignIdx === -1) return listOrphans();
  const oldName = argv[assignIdx + 1];
  const clientId = Number(argv[assignIdx + 2]);
  if (!oldName || !Number.isInteger(clientId)) {
    throw new Error('Usage: --assign "<old client name>" <clientId> [--apply]');
  }
  return assign(oldName, clientId);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
