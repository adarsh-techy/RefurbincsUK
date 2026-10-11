const router = require('express').Router();
const trashController = require('../controllers/trash.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Both super_admin and admin can access and inspect trash items
// Trash holds snapshots of deleted clients / staff (incl. personal data):
// super admin only.
router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', trashController.getStats);
router.get('/', trashController.list);
router.get('/:id', trashController.getById);
router.delete('/:id', trashController.remove);
router.delete('/', requireRole('super_admin'), trashController.clearAll);

module.exports = router;
