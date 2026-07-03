const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.post('/', requireAuth, withdrawalController.createWithdrawal);
router.get('/my', requireAuth, withdrawalController.myWithdrawals);

// Admin
router.get('/admin/all', requireAuth, requireAdmin, withdrawalController.adminListWithdrawals);
router.post('/admin/:id/review', requireAuth, requireAdmin, withdrawalController.adminReviewWithdrawal);

module.exports = router;
