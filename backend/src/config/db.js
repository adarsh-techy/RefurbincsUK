const { Pool } = require('pg');
const env = require('./env');

// DATABASE_URL (managed Postgres providers) takes priority over the
// discrete DB_HOST/... fields (local dev). Managed providers put their
// Postgres behind a cert pg doesn't have in its trust store by default, so
// connections need ssl on; rejectUnauthorized is off because most of these
// providers (Render, Railway, Supabase, Neon) use certs a plain Node
// install can't otherwise verify — the connection itself is still
// encrypted, this only skips validating the cert chain.
const pool = env.db.url
  ? new Pool({ connectionString: env.db.url, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: env.db.host,
      port: env.db.port,
      database: env.db.name,
      user: env.db.user,
      password: env.db.password,
    });

// Fired when an *idle* pooled connection drops (managed Postgres such as
// Neon closes idle connections routinely). The pool discards that client and
// opens a fresh one on the next query, so log it and carry on — exiting here
// took the whole API down, dropping every in-flight request.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
