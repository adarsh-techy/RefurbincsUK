const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { loginRateLimit } = require('../middlewares/login-rate-limit');

router.post('/login', loginRateLimit, authController.login);
// Create Super Admin: only a signed-in super admin may call this once any
// account exists (the very first account on an empty database is allowed so
// a fresh install can be bootstrapped). See authController.register.
router.post('/register', loginRateLimit, optionalAuth, authController.register);
router.get('/me', requireAuth, authController.me);
router.patch('/change-password', requireAuth, authController.changePassword);

module.exports = router;
