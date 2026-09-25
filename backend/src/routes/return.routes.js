const router = require('express').Router();
const multer = require('multer');
const returnController = require('../controllers/return.controller');
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

    // Both must pass: the extension decides the Content-Type the file is later
    // served with, so a spoofed mimetype must not let e.g. an .html through.
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !isAllowedExt) {
      const err = new Error('Only PDF documents and image files (PNG, JPG, JPEG, WEBP) are allowed.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(requireAuth);

router.get('/', requirePermission('returns'), returnController.list);
router.get('/:id', returnController.getById);
router.post('/', requirePermission('returns'), uploadDoc.single('docFile'), returnController.create);
router.patch('/:id/verify-receipt', returnController.verifyReceipt);
// Editing/removing a return (with battery status reversal) is super_admin only.
router.patch('/:id', requireRole('super_admin'), uploadDoc.single('docFile'), returnController.update);
router.delete('/:id', requireRole('super_admin'), returnController.remove);

module.exports = router;

