const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables seamlessly from root or backend folder (most recently saved file wins)
const rootDir = path.resolve(__dirname, '..', '..', '..');
const backendDir = path.resolve(__dirname, '..', '..');

const candidatePaths = [
  path.join(rootDir, '.env'),
  path.join(rootDir, '.env.local'),
  path.join(backendDir, '.env'),
  path.join(backendDir, '.env.local'),
].filter((p) => fs.existsSync(p));

// Sort files by last modified time ascending so that the most recently edited file overrides
candidatePaths.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

for (const envPath of candidatePaths) {
  dotenv.config({ path: envPath, override: true });
}

module.exports = {
  port: process.env.PORT || 5000,
  httpsPort: process.env.HTTPS_PORT || 5443,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Comma-separated in production so the Vercel production domain and any
  // custom domain can both be whitelisted, e.g.
  // "https://refurbinics.vercel.app,https://app.refurbinics.com".
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((url) => url.trim()),
  db: {
    // Set by managed Postgres providers (Render/Railway/Supabase/Neon/etc.)
    // as a single connection string. Takes priority over the discrete
    // DB_HOST/DB_PORT/... fields below, which exist for local dev against a
    // plain, non-SSL Postgres install. See db.js for how the two are used.
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
