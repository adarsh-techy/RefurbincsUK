const router = require('express').Router();
const multer = require('multer');
const invoiceController = require('../controllers/invoice.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const upload = multer({
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

// File download / view (accessible by admin and authorized clients)
router.get('/:id/download', invoiceController.downloadFile);

// Admin-managed routes (super_admin only)
router.get('/', requireRole('super_admin'), invoiceController.list);
router.get('/:id', requireRole('super_admin'), invoiceController.getById);
router.post('/', requireRole('super_admin'), upload.single('pdfFile'), invoiceController.create);
router.patch('/:id', requireRole('super_admin'), upload.single('pdfFile'), invoiceController.update);
router.delete('/:id', requireRole('super_admin'), invoiceController.remove);

module.exports = router;
