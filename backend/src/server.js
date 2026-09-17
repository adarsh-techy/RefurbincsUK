const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const realtime = require('./realtime');
const { runMigrations } = require('./db/migrate');

// Self-signed dev cert (see certs/). Served *alongside* plain http, not
// instead of it: the web frontend needs https for getUserMedia (browsers
// refuse camera access on a non-secure LAN origin), but the Expo mobile app
// uses its own native camera module (expo-camera) — it never needed https,
// and React Native rejects self-signed certs outright with no click-through
// trust flow like a browser has. Forcing https-only broke mobile for no
// benefit, so both protocols run at once on separate ports.
const CERT_DIR = path.join(__dirname, '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

async function start() {
  try {
    const { rows } = await db.query(
      'SELECT current_database() AS db_name, current_user AS user_name, inet_server_addr() AS host, inet_server_port() AS port'
    );
    const activeDb = rows[0]?.db_name || env.db.name || 'unknown';
    const activeUser = rows[0]?.user_name || env.db.user || 'unknown';
    const host = env.db.host || rows[0]?.host || 'localhost';
    const port = env.db.port || rows[0]?.port || 5432;
    console.log(`✅ Connected to PostgreSQL [Database: "${activeDb}", Host: ${host}:${port}, User: ${activeUser}]`);

    await runMigrations(false);
  } catch (err) {
    const targetHost = env.db.host || 'localhost';
    const targetDb = env.db.name || 'unknown';
    console.error(`❌ Failed to connect to PostgreSQL (Target: ${targetHost}:${env.db.port || 5432}/${targetDb}):`, err.message);
    process.exit(1);
  }

  const httpServer = http.createServer(app);
  httpServer.listen(env.port, () => {
    console.log(`Refurbinics API running on port ${env.port} [${env.nodeEnv}] (http)`);
  });

  const servers = [httpServer];

  const hasCert = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
  if (hasCert) {
    const httpsServer = https.createServer(
      { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) },
      app
    );
    httpsServer.listen(env.httpsPort, () => {
      console.log(`Refurbinics API also running on port ${env.httpsPort} [${env.nodeEnv}] (https)`);
    });
    servers.push(httpsServer);
  }

  realtime.init(servers);
}

start();
