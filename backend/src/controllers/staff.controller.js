const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const staffModel = require('../models/staff.model');
const trashModel = require('../models/trash.model');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'staff-docs');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

async function list(req, res, next) {
  try {
    res.json(await staffModel.findAll());
  } catch (err) {
    next(err);
  }
}

// loginEmail/tempPassword are optional — supplying both also grants this
// staff member a technician login account, which must set its own password
// on first login (see must_change_password).
async function create(req, res, next) {
  try {
    const {
      name,
      phone,
      salary,
      role,
      email,
      loginEmail,
      tempPassword,
      passportNumber,
      passport_number,
      niNumber,
      ni_number,
      shareCode,
      share_code,
    } = req.body;

    const finalEmail = email || loginEmail || undefined;
    const finalPassport = passportNumber || passport_number || undefined;
    const finalNi = niNumber || ni_number || undefined;
    const finalShareCode = shareCode || share_code || undefined;

    let documentPath = undefined;
    let documentName = undefined;

    if (req.file) {
      ensureUploadsDir();
      const cleanOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `doc-${Date.now()}-${cleanOriginal}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
      documentPath = filename;
      documentName = req.file.originalname;
    }

    const passwordHash =
      finalEmail && tempPassword ? await bcrypt.hash(tempPassword, 10) : undefined;

    const staff = await staffModel.create({
      name,
      phone,
      salary,
      role,
      email: finalEmail,
      passwordHash,
      passportNumber: finalPassport,
      niNumber: finalNi,
      shareCode: finalShareCode,
      documentPath,
      documentName,
    });
    res.status(201).json(staff);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      name,
      phone,
      active,
      salary,
      role,
      email,
      passportNumber,
      passport_number,
      niNumber,
      ni_number,
      shareCode,
      share_code,
    } = req.body;

    let documentPath = undefined;
    let documentName = undefined;

    if (req.file) {
      ensureUploadsDir();
      const cleanOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `doc-${Date.now()}-${cleanOriginal}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
      documentPath = filename;
      documentName = req.file.originalname;
    }

    const staff = await staffModel.update(req.params.id, {
      name,
      phone,
      active,
      salary,
      role,
      email: email !== undefined ? email : undefined,
      passportNumber: (passportNumber !== undefined ? passportNumber : passport_number),
      niNumber: (niNumber !== undefined ? niNumber : ni_number),
      shareCode: (shareCode !== undefined ? shareCode : share_code),
      documentPath,
      documentName,
    });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    res.json(staff);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const staff = await staffModel.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    await staffModel.remove(req.params.id);

    try {
      await trashModel.record({
        originalId: staff.id,
        itemType: 'staff',
        title: staff.name || `Staff Member #${staff.id}`,
        subtitle: `Role: ${staff.role || 'technician'} • Email: ${staff.email || 'N/A'} • Employee ID: ${staff.employee_id || 'N/A'}`,
        itemData: staff,
        user: req.user,
      });
    } catch (trashErr) {
      console.error('Error logging staff to trash:', trashErr);
    }

    res.status(204).end();
  } catch (err) {
    // FK violation: this staff member has repair history.
    if (err.code === '23503') {
      return res.status(409).json({
        message:
          'Cannot delete a staff member with repair history. Mark them inactive instead.',
      });
    }
    next(err);
  }
}

// Staff detail page: profile plus every repair they've logged and issues reported
async function getById(req, res, next) {
  try {
    const staff = await staffModel.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    const [repairs, issues] = await Promise.all([
      staffModel.findRepairs(req.params.id),
      staffModel.findIssues(req.params.id),
    ]);
    res.json({ staff, repairs, issues: issues || [] });
  } catch (err) {
    next(err);
  }
}

// The logged-in technician's own staff record plus their repair history —
// resolved from the linked login account rather than trusting an id from
// the request, same pattern as client.controller.js's myDashboard.
async function myProfile(req, res, next) {
  try {
    const staff = await staffModel.findByUserId(req.user.id);
    if (!staff) {
      return res.status(409).json({ message: 'Your account is not linked to a staff record.' });
    }
    const [repairs, issues] = await Promise.all([
      staffModel.findRepairs(staff.id),
      staffModel.findIssues(staff.id),
    ]);
    res.json({ staff, repairs, issues });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, getById, myProfile };
