const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { corsOrigin } = require('./config/cors-origin');
const { notFound, errorHandler } = require('./middlewares/error-handler');
const { requireAuth } = require('./middlewares/auth');

const app = express();

app.use(cors({ origin: corsOrigin, credentials: true, optionsSuccessStatus: 200 }));
app.use(compression());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Client logos are served as plain public static files (unlike invoice
// PDFs, which stream through an authenticated endpoint) so the client
// dashboard can just point an <img> tag straight at one — a logo isn't
// sensitive, and an <img src> can't carry an Authorization header anyway.
app.use('/uploads/client-logos', express.static(path.join(__dirname, '..', 'uploads', 'client-logos')));
// Staff documents (passport scans, NI numbers, share codes) and issue photos
// contain PII/sensitive content, so they require a valid session — passed as
// either an Authorization header or a ?token= query param (see requireAuth),
// the latter needed since <img>/<a href> can't set headers.
app.use('/uploads/staff-docs', requireAuth, express.static(path.join(__dirname, '..', 'uploads', 'staff-docs')));
app.use('/uploads/issue-photos', requireAuth, express.static(path.join(__dirname, '..', 'uploads', 'issue-photos')));
app.use('/uploads/return-docs', requireAuth, express.static(path.join(__dirname, '..', 'uploads', 'return-docs')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
