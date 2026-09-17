const router = require('express').Router();
const financeController = require('../controllers/finance.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Profit/loss figures are sensitive (staff salaries), so only super_admin sees them.
router.use(requireAuth, requireRole('super_admin'));
router.get('/summary', financeController.summary);
router.get('/period-detail', financeController.periodDetail);

module.exports = router;
