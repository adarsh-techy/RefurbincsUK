const router = require('express').Router();
const serviceController = require('../controllers/service.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');
const { auditTrail } = require('../middlewares/audit-trail');

router.use(requireAuth);

// Read is open to workshop logins (staff & technicians need to see available
// testing services) but not clients — rows carry rates.
router.get('/', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), serviceController.list);
router.get('/:id', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), serviceController.getById);

// Changing services / rates needs the Services module (super_admin always
// has it) — the same rule Issue Reasons and Parts use.
router.post('/', requirePermission('services'), auditTrail('service', 'create'), serviceController.create);
router.patch('/:id', requirePermission('services'), auditTrail('service', 'update'), serviceController.update);
router.delete('/:id', requirePermission('services'), auditTrail('service', 'delete'), serviceController.remove);

module.exports = router;
