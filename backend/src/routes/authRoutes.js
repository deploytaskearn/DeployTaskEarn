const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', requireAuth, authController.verifyEmail);
router.post('/resend-verification', requireAuth, authController.resendVerification);
router.post('/admin-login', authController.adminLogin);
router.get('/admin-me', requireAuth, authController.adminMe);
router.get('/me', requireAuth, authController.getMe);
router.patch('/profile', requireAuth, authController.updateProfile);

module.exports = router;
