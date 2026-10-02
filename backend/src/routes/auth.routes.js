const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');
const { loginRateLimit } = require('../middlewares/login-rate-limit');

router.post('/login', loginRateLimit, authController.login);
// Bootstrap only — refuses once any user exists (see authController.register).
router.post('/register', authController.register);
router.get('/me', requireAuth, authController.me);
router.patch('/change-password', requireAuth, authController.changePassword);

module.exports = router;
