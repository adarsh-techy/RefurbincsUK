const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);
// Workshop-wide figures (all clients, staff names) — office logins only.
router.get('/summary', requireRole('super_admin', 'admin', 'staff'), dashboardController.summary);

module.exports = router;
