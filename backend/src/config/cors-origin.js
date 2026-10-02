const env = require('./env');

// Allow requests from:
//   - No origin (server-to-server / curl / native mobile app)
//   - Any host/port in development (localhost, 127.0.0.1, LAN IP)
//   - Any Vercel deployment (*.vercel.app, preview URLs, branch URLs)
//   - Custom domains (*.refurbnics.co.uk, *.refurbinics.com, etc.)
//   - The configured CLIENT_URL origin(s) in production (comma-separated)
//
// Shared between Express CORS middleware (app.js) and Socket.IO (realtime/index.js).

const vercelOrigin = /^https:\/\/[a-z0-9-.]+\.vercel\.app$/i;
const refurbnicsDomain = /^https:\/\/(.*\.)?(refurbnics|refurbinics)\.(co\.uk|com)$/i;

function corsOrigin(origin, callback) {
  // Allow requests with no origin (e.g. server-to-server, curl, mobile native apps)
  if (!origin) return callback(null, true);

  // In development, automatically allow all origins (localhost on any port, LAN IP, HTTPS/HTTP)
  if (env.nodeEnv !== 'production') {
    return callback(null, true);
  }

  // Any vercel.app deployment (e.g. refurbincs-uk-git-main-adarsh-techys-projects.vercel.app, preview URLs)
  if (vercelOrigin.test(origin)) return callback(null, true);

  // Refurbnics / Refurbinics production domains
  if (refurbnicsDomain.test(origin)) return callback(null, true);

  // Allow explicitly configured CLIENT_URL(s)
  if (env.clientUrls.includes(origin)) return callback(null, true);

  // Block everything else in production
  return callback(new Error(`CORS: origin ${origin} not allowed`));
}

module.exports = { corsOrigin };
