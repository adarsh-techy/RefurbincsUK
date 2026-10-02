const router = require('express').Router();
const ticketController = require('../controllers/ticket.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);
// Support tickets are between clients and the office — not technicians.
router.use(requireRole('client', 'recycle_client', 'super_admin', 'admin', 'staff'));

router.get('/stats', ticketController.getStats);
router.get('/', ticketController.list);
router.get('/:id', ticketController.getById);
router.post('/', ticketController.create);
router.post('/:id/messages', ticketController.addMessage);
router.patch('/:id/status', ticketController.updateStatus);

module.exports = router;
