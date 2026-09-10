const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificate.controller');
const { authenticateToken, requireRole } = require('../middlewares/auth');

// Public verification of a certificate by certificate code
router.get('/verify/:code', certificateController.getByCode);

// Authenticated routes
router.use(authenticateToken);

// Client milestone checks & acknowledgement
router.get('/my-milestones', requireRole('client', 'recycle_client'), certificateController.getMyMilestones);
router.post('/acknowledge/:id', requireRole('client', 'recycle_client'), certificateController.acknowledgeCertificate);

// Admin / Staff certificate management
router.get('/admin', requireRole('super_admin', 'admin', 'staff'), certificateController.listAdmin);

module.exports = router;
