const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');

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

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await userModel.findById(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
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
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await userModel.findById(decoded.id);
    if (user && user.active) {
      req.user = user;
    }
    next();
  } catch {
    next();
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

module.exports = { requireAuth, optionalAuth, requireRole, requirePermission };

