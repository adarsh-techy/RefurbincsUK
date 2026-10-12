const router = require('express').Router();
const trashController = require('../controllers/trash.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Trash holds snapshots of deleted clients / staff (incl. personal data):
// super admin only.
router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', trashController.getStats);
router.get('/', trashController.list);
router.get('/:id', trashController.getById);
router.post('/:id/restore', trashController.restore);
router.delete('/:id', trashController.remove);
router.delete('/', trashController.clearAll);

module.exports = router;
