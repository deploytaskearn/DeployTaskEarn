const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mysteryController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/info', requireAuth, ctrl.getInfo);
router.post('/open', requireAuth, ctrl.openBox);
router.post('/buy-premium', requireAuth, ctrl.buyAndOpenPremium);
router.post('/redeem-coins/free', requireAuth, ctrl.redeemCoinsForFreeBox);

module.exports = router;
