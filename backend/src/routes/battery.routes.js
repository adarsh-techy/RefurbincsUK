const router = require('express').Router();
const multer = require('multer');
const batteryController = require('../controllers/battery.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

// RFID Assignment sheet upload (.xlsx / .csv), parsed in memory
const RFID_SHEET_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/comma-separated-values', // Android's name for .csv
  'application/vnd.ms-excel',
]);
const uploadRfidSheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Decide by extension: the file is parsed in memory and never stored, and
  // browsers/OSes report CSV and XLSX with inconsistent MIME types
  // (application/octet-stream is common for .csv on macOS).
  fileFilter: (req, file, cb) => {
    const okExt = /\.(xlsx|csv)$/i.test(file.originalname || '');
    const okType = RFID_SHEET_TYPES.has(file.mimetype) || file.mimetype === 'application/octet-stream' || !file.mimetype;
    if (!okExt || !okType) {
      const err = new Error('Only .xlsx or .csv files are supported');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

const uploadIssuePhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file, up to 3 files
});

// Must precede '/:code' below, or these would be swallowed as battery code
// lookups.
router.get('/count-by-client', requireAuth, requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), batteryController.countByClient);
router.get('/serial-numbers', requireAuth, requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), batteryController.listSerialNumbers);
router.get('/repeat-intakes-this-month', requireAuth, requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), batteryController.repeatIntakesThisMonth);
router.get('/rfid-assignments', requireAuth, requireRole('super_admin', 'admin', 'staff'), batteryController.listRfidAssignments);
router.get('/rfid-template', requireAuth, requireRole('super_admin', 'admin', 'staff'), batteryController.rfidTemplate);
router.get('/unserviceable-count', requireAuth, requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), batteryController.unserviceableCount);

// Public / client QR code tracking endpoint — anyone scanning a QR code can see
// full battery details and history, while authenticated users are also identified.
router.get('/:code', optionalAuth, batteryController.getByCode);

router.use(requireAuth);
// The full fleet list spans every client, so it's workshop logins only —
// clients read their own batteries through /clients/me/batteries.
router.get('/', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), batteryController.list);

// Registering a battery from the Generate QR Code page is a routine
// front-desk action, open to office logins (not clients/technicians).
router.post('/generate', requireRole('super_admin', 'admin', 'staff'), batteryController.generate);
// Bulk generating up to 50,000 QR codes for a client.
router.post('/generate-bulk', requireRole('super_admin', 'admin', 'staff'), batteryController.generateBulk);
// RFID Assignment page: upload a sheet of battery number + tag; ?dryRun=true
// previews the matching without writing.
router.post(
  '/rfid-assign',
  requireRole('super_admin', 'admin', 'staff'),
  uploadRfidSheet.single('file'),
  batteryController.assignRfidSheet
);
// Assigning a client (for the Generate QR Code page).
router.patch('/:id/client', requireRole('super_admin', 'admin', 'staff'), batteryController.updateClient);
// Assigning or updating physical Battery Number (serial_number).
// Open to workshop logins and the owning client (client-locked once the
// client sets it; ownership is enforced in the controller).
router.patch(
  '/:id/serial-number',
  requireRole('client', 'super_admin', 'admin', 'staff', 'technician', 'supervisor'),
  batteryController.updateSerialNumber
);
// A technician or staff claiming a battery to start work on — before any part is
// logged, so it shows as actively being worked on rather than just queued.
router.patch(
  '/:id/start-work',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  batteryController.startWork
);
// A supervisor or admin starting the test timer when scanning/opening an in_testing battery.
router.patch(
  '/:id/start-testing',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  batteryController.startTesting
);
// A technician (Supervisor only, enforced in the controller), staff
// member, or admin confirming a battery works after its parts were replaced.
router.patch(
  '/:id/complete-testing',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  batteryController.completeTesting
);
// A technician (mid-repair) or a supervisor, during
// testing — reporting that a battery can't be serviced, with up to 3 photos.
router.patch(
  '/:id/report-issue',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  uploadIssuePhotos.array('photos', 3),
  batteryController.reportIssue
);
// Reclaiming parts fitted during repair from a battery that failed testing —
// open to the same workshop logins as report-issue/complete-testing.
router.patch(
  '/:id/remove-parts',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  batteryController.removeParts
);
// A supervisor passing a battery back to the technician pool
router.patch(
  '/:id/pass-to-tech',
  requireRole('technician', 'supervisor', 'staff', 'admin', 'super_admin'),
  batteryController.passToTech
);
// Editing/removing batteries (manual status correction) is super_admin only.
router.patch('/:id', requireRole('super_admin'), batteryController.update);
router.delete('/:id', requireRole('super_admin'), batteryController.remove);
// Hides/restores a battery app-wide without deleting it — super_admin only.
router.patch('/:id/block', requireRole('super_admin'), batteryController.setBlocked);

module.exports = router;
