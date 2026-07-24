const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/history', requireAuth, walletController.myHistory);

module.exports = router;
