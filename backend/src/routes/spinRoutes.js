const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/spinController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/info', requireAuth, ctrl.getSpinInfo);
router.post('/spin', requireAuth, ctrl.spin);
router.post('/buy-gold-spin', requireAuth, ctrl.buyGoldSpin);
router.post('/gold-spin', requireAuth, ctrl.spinGold);
router.post('/redeem', requireAuth, ctrl.redeemCode);
router.post('/redeem-coins/free', requireAuth, ctrl.redeemCoinsForFreeSpin);

module.exports = router;
