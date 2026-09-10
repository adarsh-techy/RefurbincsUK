const router = require('express').Router();
const recycleController = require('../controllers/recycle.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

// recycle_client can list their own batches and view detail; all other
// operations (create, edit, delete) stay admin-permission-gated.
function requireRecycleAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.role === 'recycle_client') return next(); // own batches only (scoped in controller)
  // fall through to the normal permission check
  return requirePermission('recycle')(req, res, next);
}

router.use(requireAuth);
router.get('/', requireRecycleAccess, recycleController.list);
router.get('/:id', requireRecycleAccess, recycleController.getById);
router.post('/', requirePermission('recycle'), recycleController.create);
// Editing/removing a recycle batch (with battery status reversal) is super_admin only.
router.patch('/:id', requireRole('super_admin'), recycleController.update);
router.delete('/:id', requireRole('super_admin'), recycleController.remove);

module.exports = router;
