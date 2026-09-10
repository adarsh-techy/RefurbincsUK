const router = require('express').Router();
const multer = require('multer');
const truckIntakeController = require('../controllers/truck-intake.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  'application/vnd.ms-excel', // some browsers send this for .csv
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error('Only .xlsx or .csv files are supported');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(requireAuth, requirePermission('truck_intakes'));
router.get('/', truckIntakeController.list);
router.get('/:id', truckIntakeController.getById);
router.post('/', truckIntakeController.create);
router.post('/import', upload.single('file'), truckIntakeController.importSheet);
router.patch('/:id/verify-arrival', truckIntakeController.verifyArrival);
// Editing/removing intakes is super_admin only, distinct from the
// 'truck_intakes' permission (which only covers recording new intakes).
router.patch('/:id', requireRole('super_admin'), truckIntakeController.update);
router.delete('/:id', requireRole('super_admin'), truckIntakeController.remove);

module.exports = router;
