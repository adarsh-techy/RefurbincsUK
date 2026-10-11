const router = require('express').Router();
const truckIntakeController = require('../controllers/truck-intake.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

router.use(requireAuth, requirePermission('truck_intakes'));
router.get('/', truckIntakeController.list);
router.get('/:id', truckIntakeController.getById);
// Truck intakes are recorded by clients from their portal
// (POST /clients/me/truck-intakes); office staff only verify / edit them.
const intakesAreClientOnly = (req, res) =>
  res.status(403).json({ message: 'Truck intakes are recorded by clients from their portal. The workshop verifies them on arrival.' });
router.post('/', intakesAreClientOnly);
router.post('/import', intakesAreClientOnly);
router.patch('/:id/verify-arrival', truckIntakeController.verifyArrival);
// Editing/removing intakes is super_admin only, distinct from the
// 'truck_intakes' permission (viewing and verifying intakes).
router.patch('/:id', requireRole('super_admin'), truckIntakeController.update);
router.delete('/:id', requireRole('super_admin'), truckIntakeController.remove);

module.exports = router;
