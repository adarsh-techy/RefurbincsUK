const router = require('express').Router();
const multer = require('multer');
const staffController = require('../controllers/staff.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');
const { auditTrail } = require('../middlewares/audit-trail');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const isAllowedExt =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp');

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !isAllowedExt) {
      const err = new Error('Only PDF documents and image files (PNG, JPG, JPEG, WEBP) are allowed.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(requireAuth);
// Staff records hold salary, passport and NI numbers, so reads are limited to
// office roles (the Repairs form's staff dropdown) — never client or
// technician logins.
router.get('/', requireRole('super_admin', 'admin', 'staff'), staffController.list);
// Must come before /:id or it would be swallowed as an id param.
router.get('/me', staffController.myProfile);
// Full record (documents, salary, IDs) needs the Staff module.
router.get('/:id', requirePermission('staff'), staffController.getById);
router.post('/', requirePermission('staff'), auditTrail('staff', 'create'), uploadDoc.single('docFile'), staffController.create);
// Editing staff records needs the Staff module (super_admin always has it)
router.patch('/:id', requirePermission('staff'), auditTrail('staff', 'update'), uploadDoc.single('docFile'), staffController.update);
router.delete('/:id', requireRole('super_admin'), auditTrail('staff', 'delete'), staffController.remove);

module.exports = router;
