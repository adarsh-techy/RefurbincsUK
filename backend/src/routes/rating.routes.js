const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/rating.controller');
const { authenticateToken, requireRole } = require('../middlewares/auth');

router.use(authenticateToken);

// Client or Admin can submit rating
router.post('/', ratingController.create);

// Client can view their previous ratings
router.get('/my', requireRole('client', 'recycle_client'), ratingController.myRatings);

// Admin / Staff can view all ratings with full stats
router.get('/', requireRole('super_admin', 'admin', 'staff'), ratingController.list);

module.exports = router;
