const router = require('express').Router();
const multer = require('multer');
const clientController = require('../controllers/client.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
      const err = new Error('Only PNG, JPEG, WEBP, or SVG logo images are supported.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(requireAuth);
// Read is open to any authenticated user: the Truck Intake form needs the
// client list for its dropdown regardless of who can manage clients.
router.get('/', clientController.list);
router.get('/me/dashboard', requireRole('client'), clientController.myDashboard);
router.get('/me/batteries', requireRole('client'), clientController.myBatteries);
router.post('/me/batteries/pack-to-repair', requireRole('client'), clientController.packBatteryForRepair);
router.get('/me/transactions', requireRole('client'), clientController.myTransactions);
router.get('/me/history', requireRole('client'), clientController.myHistory);
router.get('/me/invoices', requireRole('client'), clientController.myInvoices);
router.get('/me/notifications', requireRole('client'), clientController.myNotifications);
router.get('/:id', clientController.getById);
router.post('/', requirePermission('clients'), uploadLogo.single('logo'), clientController.create);
// Editing/removing clients is super_admin only, distinct from the 'clients'
// permission (which only covers adding new clients).
router.patch('/:id', requireRole('super_admin'), uploadLogo.single('logo'), clientController.update);
router.delete('/:id', requireRole('super_admin'), clientController.remove);

module.exports = router;
