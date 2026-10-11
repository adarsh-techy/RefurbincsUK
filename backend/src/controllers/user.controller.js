const bcrypt = require('bcryptjs');
const db = require('../config/db');
const userModel = require('../models/user.model');
const auditLogModel = require('../models/audit-log.model');
const { PERMISSIONS } = require('../config/permissions');

async function list(req, res, next) {
  try {
    let roles = ['admin', 'super_admin'];
    if (req.query.role === 'all') {
      roles = undefined;
    } else if (req.query.role) {
      roles = req.query.role.split(',').map((r) => r.trim()).filter(Boolean);
    }
    res.json(await userModel.findAll({ roles }));
  } catch (err) {
    next(err);
  }
}

// Super admin only: create an admin account with a specific set of module
// permissions, per spec's role/permission management requirement.
async function create(req, res, next) {
  try {
    const { name, email, password, role, permissions } = req.body;
    const safeRole = ['super_admin', 'recycle_client'].includes(role) ? role : 'admin';

    // super_admin and recycle_client have no per-module permissions list;
    // an admin only gets the subset of known permission keys it was given.
    const grantedPermissions =
      safeRole === 'admin'
        ? (Array.isArray(permissions) ? permissions : []).filter((p) =>
            PERMISSIONS.includes(p)
          )
        : [];

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
      name,
      email,
      passwordHash,
      role: safeRole,
      permissions: grantedPermissions,
    });

    if (safeRole === 'recycle_client') {
      await db.query(
        'INSERT INTO clients (name, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [name, user.id]
      );
    }

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'user',
      entityId: user.id,
      details: { email, role: safeRole, permissions: grantedPermissions },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// Edit an admin's profile, role, permissions, or active status. Also used
// as the "delete" action from the UI (active: false) — a real DELETE would
// be blocked by that user's own audit_logs history anyway, and this
// preserves attribution while immediately revoking access.
async function update(req, res, next) {
  try {
    const targetId = Number(req.params.id);
    const { name, email, role, permissions, active } = req.body;

    const existing = await userModel.findById(targetId);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Fields left out keep their current value (a bare { active } toggle must
    // not blank the name/email or reactivate anyone). Only office logins
    // (admin / super_admin / recycle_client) can have their role set here;
    // client, staff and workshop logins keep their role — this endpoint must
    // never turn them into admins.
    const OFFICE_ROLES = ['admin', 'super_admin', 'recycle_client'];
    const safeRole = !OFFICE_ROLES.includes(existing.role)
      ? existing.role
      : OFFICE_ROLES.includes(role)
        ? role
        : existing.role;

    if (targetId === req.user.id && active === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    // admin modules: the ones sent (filtered), or the current ones if none were
    // sent; other roles keep whatever they already had
    const currentPermissions = Array.isArray(existing.permissions) ? existing.permissions : [];
    const grantedPermissions =
      safeRole === 'admin'
        ? Array.isArray(permissions)
          ? permissions.filter((p) => PERMISSIONS.includes(p))
          : currentPermissions
        : OFFICE_ROLES.includes(safeRole)
          ? []
          : currentPermissions;

    const user = await userModel.update(targetId, {
      name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
      email: typeof email === 'string' && email.trim() ? email.trim() : existing.email,
      role: safeRole,
      permissions: grantedPermissions,
      active: typeof active === 'boolean' ? active : existing.active,
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await auditLogModel.record({
      userId: req.user.id,
      action: 'update',
      entity: 'user',
      entityId: user.id,
      details: { email, role: safeRole, active: user.active },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    await userModel.remove(targetId);
    res.status(204).end();
  } catch (err) {
    // FK violation: this account has an audit trail (or other attributed
    // records) — deactivate instead of a hard delete so history/attribution
    // is preserved.
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete an admin with activity history. Deactivate them instead.',
      });
    }
    next(err);
  }
}

module.exports = { list, create, update, remove };
