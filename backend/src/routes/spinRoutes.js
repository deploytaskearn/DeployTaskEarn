const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/spinController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/info', requireAuth, ctrl.getSpinInfo);
router.post('/spin', requireAuth, ctrl.spin);
router.post('/buy-gold-spin', requireAuth, ctrl.buyAndSpinGold);
router.post('/redeem', requireAuth, ctrl.redeemCode);

module.exports = router;
