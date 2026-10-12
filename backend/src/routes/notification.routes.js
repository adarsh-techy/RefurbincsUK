const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);

// Admin & Operations notification hub
router.get('/admin', requireRole('super_admin', 'admin', 'staff'), notificationController.getAdminNotifications);
router.get('/admin/:id', requireRole('super_admin', 'admin', 'staff'), notificationController.getAdminNotificationById);

module.exports = router;
