// Creates (or resets) a Super Admin login. Credentials come from the command
// line or env — never from this file, so no password is committed to git.
//
//   node scripts/seed-superadmin.js <email> <password> ["Full Name"] [--keep-password]
//   SEED_SUPERADMIN_EMAIL=… SEED_SUPERADMIN_PASSWORD=… node scripts/seed-superadmin.js
//
// If the email already exists the account is turned into an active
// super_admin and its password is reset. By default the user must choose a
// new password at first login; --keep-password skips that.
require('../src/config/env');
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const keepPassword = process.argv.includes('--keep-password');
const email = (args[0] || process.env.SEED_SUPERADMIN_EMAIL || '').trim().toLowerCase();
const password = args[1] || process.env.SEED_SUPERADMIN_PASSWORD || '';
const name = (args[2] || process.env.SEED_SUPERADMIN_NAME || 'Super Admin').trim();

async function main() {
  if (!email || !password) {
    console.error('Usage: node scripts/seed-superadmin.js <email> <password> ["Full Name"] [--keep-password]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const mustChange = !keepPassword;
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, permissions, must_change_password, active)
     VALUES ($1, $2, $3, 'super_admin', '[]', $4, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'super_admin',
           active = true,
           must_change_password = EXCLUDED.must_change_password
     RETURNING id, email, (xmax = 0) AS created`,
    [name, email, passwordHash, mustChange]
  );
  const row = rows[0];
  console.log(`${row.created ? 'Created' : 'Updated'} super admin #${row.id} ${row.email}` +
    (mustChange ? ' — must change password at first login.' : '.'));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
