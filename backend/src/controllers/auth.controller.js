const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const userModel = require('../models/user.model');
const staffModel = require('../models/staff.model');
const clientModel = require('../models/client.model');
const env = require('../config/env');
const { PERMISSIONS } = require('../config/permissions');

function signToken(user) {
  // Only the id is embedded — requireAuth re-fetches role/permissions fresh
  // from the DB on every request, so nothing else here is ever trusted.
  return jwt.sign({ id: user.id }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

// A client's uploaded logo lives on their `clients` row, not the `users`
// login row — the Sidebar (which every client sees on every page, not just
// the dashboard) needs it on the session's own user object to show it
// instead of the generic Refurbinics brand mark, so it's folded in here
// rather than making the frontend fetch a second endpoint just for this.
async function attachClientLogo(userRow) {
  if (userRow.role !== 'client') return null;
  const client = await clientModel.findByUserId(userRow.id);
  return client?.logo_path || null;
}

async function login(req, res, next) {
  try {
    const rawEmail = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const rawPassword = req.body.password != null ? String(req.body.password) : '';
    const user = await userModel.findByEmail(rawEmail);

    let passwordMatch = false;
    if (user && rawPassword) {
      passwordMatch = await bcrypt.compare(rawPassword, user.password_hash);
      if (!passwordMatch && rawPassword.trim() !== rawPassword) {
        passwordMatch = await bcrypt.compare(rawPassword.trim(), user.password_hash);
      }
    }

    if (!user || !passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.active) {
      return res.status(401).json({ message: 'This account has been deactivated' });
    }

    let staffRole = undefined;
    const staff = await staffModel.findByUserId(user.id);
    if (staff?.role) {
      staffRole = staff.role;
    } else if ((user.role || '').toLowerCase() === 'supervisor') {
      staffRole = 'supervisor';
    } else if (user.role === 'technician') {
      staffRole = 'technician';
    }
    const clientLogoPath = await attachClientLogo(user);

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staff_role: staffRole,
        staffRole: staffRole,
        staff_id: staff?.id || null,
        permissions: user.permissions,
        must_change_password: user.must_change_password,
        client_logo_path: clientLogoPath,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Create Super Admin. Once any account exists this is only open to a
// signed-in super admin — it used to be public, which let anyone on the
// internet make themselves a super admin. On an empty database the first
// account may be created without signing in (fresh-install bootstrap).
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role = req.body.role || 'super_admin';
    const user = await userModel.create({
      name,
      email,
      passwordHash,
      role,
      permissions: PERMISSIONS,
    });

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      must_change_password: user.must_change_password,
      client_logo_path: null,
    };
    // An existing signed-in super admin creating a colleague stays signed in as
    // themselves — public registrations get a session token to log in directly.
    if (req.user) {
      return res.status(201).json({ user: publicUser, created: true });
    }
    res.status(201).json({
      token: signToken(user),
      user: publicUser,
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    let staffRole = undefined;
    const staff = await staffModel.findByUserId(req.user.id);
    if (staff?.role) {
      staffRole = staff.role;
    } else if ((req.user.role || '').toLowerCase() === 'supervisor') {
      staffRole = 'supervisor';
    } else if (req.user.role === 'technician') {
      staffRole = 'technician';
    }
    const clientLogoPath = await attachClientLogo(req.user);
    res.json({
      user: {
        ...req.user,
        staff_role: staffRole,
        staffRole: staffRole,
        staff_id: staff?.id || null,
        client_logo_path: clientLogoPath,
      },
    });
  } catch (err) {
    // Without this a DB hiccup here was an unhandled rejection, which kills
    // the whole Node process (Express 4 doesn't catch async handler errors).
    next(err);
  }
}

// Sets the caller's own password — used by the forced first-login change
// screen for technician/client accounts created with an admin-issued temp
// password (see must_change_password), and by voluntary changes elsewhere
// (e.g. the client profile page).
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // The forced first-login screen doesn't collect a current password — the
    // admin-issued temp password was just verified at login. Any other
    // caller must confirm it before we'll swap it out.
    if (!req.user.must_change_password) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      const fullUser = await userModel.findByEmail(req.user.email);
      if (!fullUser || !(await bcrypt.compare(currentPassword, fullUser.password_hash))) {
        // 400, not 401: the apps treat any 401 as "session expired" and log
        // the user out, which would hide this message behind a login screen.
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await userModel.updatePassword(req.user.id, passwordHash);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, me, changePassword };
