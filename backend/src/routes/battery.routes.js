const router = require('express').Router();
const batteryController = require('../controllers/battery.controller');
const { requireAuth, optionalAuth, requireRole } = require('../middlewares/auth');

// Must precede '/:code' below, or these would be swallowed as battery code
// lookups.
router.get('/count-by-client', requireAuth, batteryController.countByClient);
router.get('/serial-numbers', requireAuth, batteryController.listSerialNumbers);
router.get('/repeat-intakes-this-month', requireAuth, batteryController.repeatIntakesThisMonth);
router.get('/unserviceable-count', requireAuth, batteryController.unserviceableCount);

// Public / client QR code tracking endpoint — anyone scanning a QR code can see
// full battery details and history, while authenticated users are also identified.
router.get('/:code', optionalAuth, batteryController.getByCode);

router.use(requireAuth);
router.get('/', batteryController.list);

// Registering a battery from the Generate QR Code page is a routine
// front-desk action, open to any authenticated user.
router.post('/generate', batteryController.generate);
// Bulk generating up to 50,000 QR codes for a client.
router.post('/generate-bulk', batteryController.generateBulk);
// Assigning a client (for the Generate QR Code page) is a routine
// front-desk action, open to any authenticated user.
router.patch('/:id/client', batteryController.updateClient);
// Assigning or updating physical Battery Number (serial_number).
// Open to admin and client (client-locked once client sets it).
router.patch('/:id/serial-number', batteryController.updateSerialNumber);
// A technician claiming a battery to start work on — before any part is
// logged, so it shows as actively being worked on rather than just queued.
router.patch('/:id/start-work', requireRole('technician'), batteryController.startWork);
// A technician confirming a battery works after its parts were replaced.
router.patch('/:id/complete-testing', requireRole('technician'), batteryController.completeTesting);
// A technician reporting mid-repair that a battery can't be serviced.
router.patch('/:id/report-issue', requireRole('technician'), batteryController.reportIssue);
// Editing/removing batteries (manual status correction) is super_admin only.
router.patch('/:id', requireRole('super_admin'), batteryController.update);
router.delete('/:id', requireRole('super_admin'), batteryController.remove);
// Hides/restores a battery app-wide without deleting it — super_admin only.
router.patch('/:id/block', requireRole('super_admin'), batteryController.setBlocked);

module.exports = router;
