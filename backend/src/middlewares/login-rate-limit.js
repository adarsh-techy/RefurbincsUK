// Small in-memory brute-force guard for POST /auth/login: after MAX_ATTEMPTS
// failed logins for the same IP + email inside WINDOW_MS, further attempts
// get 429 until the window passes. A successful login clears the counter.
// In-memory is enough for the single backend instance this app runs as; it
// resets on restart, which only ever errs towards letting people in.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map(); // key -> { count, resetAt }

function keyFor(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${req.ip}|${email}`;
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = keyFor(req);
  const entry = attempts.get(key);

  if (entry && entry.resetAt <= now) attempts.delete(key);

  const current = attempts.get(key);
  if (current && current.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((current.resetAt - now) / 60000);
    return res.status(429).json({
      message: `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    });
  }

  res.on('finish', () => {
    if (res.statusCode === 401) {
      const e = attempts.get(key) || { count: 0, resetAt: Date.now() + WINDOW_MS };
      e.count += 1;
      attempts.set(key, e);
    } else if (res.statusCode < 400) {
      attempts.delete(key);
    }
  });
  next();
}

// Drop expired entries so the map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}, WINDOW_MS).unref();

module.exports = { loginRateLimit };
