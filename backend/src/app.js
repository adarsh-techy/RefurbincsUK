const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { corsOrigin } = require('./config/cors-origin');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(cors({ origin: corsOrigin, credentials: true, optionsSuccessStatus: 200 }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Client logos are served as plain public static files (unlike invoice
// PDFs, which stream through an authenticated endpoint) so the client
// dashboard can just point an <img> tag straight at one — a logo isn't
// sensitive, and an <img src> can't carry an Authorization header anyway.
app.use('/uploads/client-logos', express.static(path.join(__dirname, '..', 'uploads', 'client-logos')));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
