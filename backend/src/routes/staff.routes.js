const router = require('express').Router();
const multer = require('multer');
const staffController = require('../controllers/staff.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

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
// Read is open to any authenticated user: the Repairs form needs the staff
// list to populate its dropdown regardless of who's logged the repair.
router.get('/', staffController.list);
// Must come before /:id or it would be swallowed as an id param.
router.get('/me', staffController.myProfile);
router.get('/:id', staffController.getById);
router.post('/', requirePermission('staff'), uploadDoc.single('docFile'), staffController.create);
// Editing/removing staff records is super_admin only, distinct from the
// 'staff' permission (which only covers adding new staff).
router.patch('/:id', requireRole('super_admin'), uploadDoc.single('docFile'), staffController.update);
router.delete('/:id', requireRole('super_admin'), staffController.remove);

module.exports = router;
