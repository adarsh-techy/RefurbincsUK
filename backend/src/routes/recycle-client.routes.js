const router = require('express').Router();
const recycleClientController = require('../controllers/recycle-client.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth, requireRole('recycle_client'));
router.get('/me/dashboard', recycleClientController.dashboard);
router.get('/me/shipments', recycleClientController.shipments);

module.exports = router;
