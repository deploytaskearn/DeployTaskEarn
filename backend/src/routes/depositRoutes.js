const express = require('express');
const router = express.Router();
const depositController = require('../controllers/depositController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { uploadDepositScreenshot } = require('../middleware/upload');

router.get('/methods', depositController.getPaymentMethods);
router.post('/', requireAuth, uploadDepositScreenshot.single('screenshot'), depositController.createDeposit);
router.get('/my', requireAuth, depositController.myDeposits);

// Admin
router.get('/admin/all', requireAuth, requireAdmin, depositController.adminListDeposits);
router.post('/admin/:id/review', requireAuth, requireAdmin, depositController.adminReviewDeposit);
router.post('/admin/methods', requireAuth, requireAdmin, depositController.adminUpsertPaymentMethod);

module.exports = router;
