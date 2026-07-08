const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mysteryController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/info', requireAuth, ctrl.getInfo);
router.post('/open', requireAuth, ctrl.openBox);

module.exports = router;
