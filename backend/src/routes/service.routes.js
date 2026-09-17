const router = require('express').Router();
const serviceController = require('../controllers/service.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);

// Read is open to any authenticated user (staff & technicians need to see available testing services)
router.get('/', serviceController.list);
router.get('/:id', serviceController.getById);

// Service management is restricted to admin and super_admin
router.post('/', requireRole('admin', 'super_admin'), serviceController.create);
router.patch('/:id', requireRole('admin', 'super_admin'), serviceController.update);
router.delete('/:id', requireRole('admin', 'super_admin'), serviceController.remove);

module.exports = router;
