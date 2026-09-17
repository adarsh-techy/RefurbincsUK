const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/rating.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.use(requireAuth);

// Client or Admin can submit rating
router.post('/', ratingController.create);

// Client can view their previous ratings
router.get('/my', requireRole('client', 'recycle_client'), ratingController.myRatings);

// Admin / Staff can view all ratings with full stats
router.get('/', requireRole('super_admin', 'admin', 'staff'), ratingController.list);
router.get('/:id', requireRole('super_admin', 'admin', 'staff', 'client', 'recycle_client'), ratingController.getById);

module.exports = router;
