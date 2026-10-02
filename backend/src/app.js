const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { corsOrigin } = require('./config/cors-origin');
const { notFound, errorHandler } = require('./middlewares/error-handler');
const { requireAuth, requireRole } = require('./middlewares/auth');

const app = express();

// Behind Render's / Caddy's reverse proxy: take the client IP from
// X-Forwarded-For so req.ip (used by the login rate limit) is the real caller.
app.set('trust proxy', 1);

app.use(cors({ origin: corsOrigin, credentials: true, optionsSuccessStatus: 200 }));
app.use(compression());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Uploaded files. One gate in front of a single static handler, deciding by
// the *normalised* first path segment — separate per-folder mounts could be
// sidestepped with paths like /uploads//staff-docs/x or encoded segments,
// which missed the guarded mounts and fell through to a public catch-all.
//   client-logos  public (an <img src> can't carry an Authorization header,
//                 and a logo isn't sensitive)
//   issue-photos, return-docs   any signed-in user
//   staff-docs    office logins only (passport scans, NI numbers)
//   anything else (incl. invoices) is not served here — invoice PDFs stream
//                 through the ownership-checked /api/invoices/:id/download.
// Auth is an Authorization header or ?token= (see requireAuth), the latter
// needed since <img>/<a href> can't set headers.
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const requireOfficeRole = requireRole('super_admin', 'admin', 'staff');
app.use(
  '/uploads',
  (req, res, next) => {
    let folder;
    try {
      folder = path.posix.normalize(decodeURIComponent(req.path)).split('/').filter(Boolean)[0];
    } catch {
      return res.status(400).json({ message: 'Bad request' });
    }
    if (folder === 'client-logos') return next();
    if (folder === 'issue-photos' || folder === 'return-docs') return requireAuth(req, res, next);
    if (folder === 'staff-docs') {
      return requireAuth(req, res, () => requireOfficeRole(req, res, next));
    }
    return res.status(404).json({ message: 'Not found' });
  },
  express.static(UPLOADS_DIR)
);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
