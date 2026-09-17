const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/users', require('./user.routes'));
router.use('/staff', require('./staff.routes'));
router.use('/truck-intakes', require('./truck-intake.routes'));
router.use('/clients', require('./client.routes'));
router.use('/batteries', require('./battery.routes'));
router.use('/parts', require('./part.routes'));
router.use('/issue-reasons', require('./issue-reason.routes'));
router.use('/repairs', require('./repair.routes'));
router.use('/returns', require('./return.routes'));
router.use('/recycle', require('./recycle.routes'));
router.use('/recycle-client', require('./recycle-client.routes'));
router.use('/audit-logs', require('./audit-log.routes'));
router.use('/finance', require('./finance.routes'));
router.use('/invoices', require('./invoice.routes'));
router.use('/tickets', require('./ticket.routes'));
router.use('/ratings', require('./rating.routes'));
router.use('/certificates', require('./certificate.routes'));
router.use('/services', require('./service.routes'));
router.use('/notifications', require('./notification.routes'));

module.exports = router;

