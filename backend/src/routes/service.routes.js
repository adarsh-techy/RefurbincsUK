const router = require('express').Router();
const serviceController = require('../controllers/service.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);

// Read is open to workshop logins (staff & technicians need to see available
// testing services) but not clients — rows carry rates.
router.get('/', requireRole('super_admin', 'admin', 'staff', 'technician'), serviceController.list);
router.get('/:id', requireRole('super_admin', 'admin', 'staff', 'technician'), serviceController.getById);

// Service management is restricted to admin and super_admin
router.post('/', requireRole('admin', 'super_admin'), serviceController.create);
router.patch('/:id', requireRole('admin', 'super_admin'), serviceController.update);
router.delete('/:id', requireRole('admin', 'super_admin'), serviceController.remove);

module.exports = router;
