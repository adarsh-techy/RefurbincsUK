const router = require('express').Router();
const partController = require('../controllers/part.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');
const { auditTrail } = require('../middlewares/audit-trail');

router.use(requireAuth);
// Read is open to workshop logins (the Repairs form and technician panel
// need part names and stock levels) but not clients — rows carry pricing.
router.get('/', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), partController.list);
router.get('/clients', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), partController.listPartClients);
router.get('/:id', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), partController.getById);
router.post('/', requirePermission('parts'), auditTrail('part', 'create'), partController.create);
// Full edit/delete (renaming, re-pricing, deleting) is super_admin only.
// Restocking is looser — anyone with the 'parts' permission can top up a
// part's quantity without needing rights to edit its other fields.
router.patch('/:id', requireRole('super_admin'), auditTrail('part', 'update'), partController.update);
router.patch('/:id/restock', requirePermission('parts'), auditTrail('part', 'restock'), partController.restock);
router.delete('/:id', requireRole('super_admin'), auditTrail('part', 'delete'), partController.remove);

module.exports = router;
