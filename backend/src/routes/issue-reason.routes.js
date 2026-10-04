const router = require('express').Router();
const issueReasonController = require('../controllers/issue-reason.controller');
const { requireAuth, requirePermission, requireRole } = require('../middlewares/auth');

router.use(requireAuth);
// Read is open to workshop logins: the mobile app's Report Issue picker
// needs the active reason list regardless of who can manage it.
router.get('/', requireRole('super_admin', 'admin', 'staff', 'technician', 'supervisor'), issueReasonController.list);
router.post('/', requirePermission('issue_reasons'), issueReasonController.create);
router.patch('/:id', requirePermission('issue_reasons'), issueReasonController.update);
// Deleting a reason outright (rather than just deactivating it) is
// super_admin only, same as parts' full edit/delete.
router.delete('/:id', requireRole('super_admin'), issueReasonController.remove);

module.exports = router;
