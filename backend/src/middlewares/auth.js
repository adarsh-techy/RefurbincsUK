const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');

// Requests a user on a temporary password may still make.
const MUST_CHANGE_ALLOWED = new Set([
  'GET /api/auth/me',
  'PATCH /api/auth/change-password',
]);

// Returns the token's user if the token is valid, the account is active and
// the token's version is still current (it's bumped on password / role /
// permission / active changes — see migration 057). Null otherwise. DB errors
// propagate so an outage isn't reported to the apps as "logged out".
async function verifyToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, env.jwt.secret);
  } catch {
    return null;
  }
  const found = await userModel.findForAuth(decoded.id);
  if (!found || !found.user.active) return null;
  if ((decoded.tv || 0) !== found.tokenVersion) return null;
  return found.user;
}

// Verifies the JWT, then re-fetches the user's current role/permissions from
// the DB rather than trusting the token's claims. This means a permission
// change (or role change) by a super_admin takes effect on the admin's very
// next request instead of only after they log in again.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  let user;
  try {
    user = await verifyToken(token);
  } catch (err) {
    return next(err);
  }
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.user = user;

  // An account on a temporary password may only finish the forced change
  // (and read itself) until it does — the apps send it to that screen first.
  if (user.must_change_password && !MUST_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`)) {
    return res.status(403).json({
      code: 'MUST_CHANGE_PASSWORD',
      message: 'Please set a new password before continuing.',
    });
  }
  next();
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }

  try {
    const user = await verifyToken(token);
    if (user && !user.must_change_password) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

// super_admin always passes; an 'admin' account needs the named module in
// its granted permissions array.
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.user.role === 'super_admin') {
      return next();
    }
    if ((req.user.permissions || []).includes(permission)) {
      return next();
    }
    res.status(403).json({ message: `Missing permission: ${permission}` });
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, requirePermission, verifyToken };

