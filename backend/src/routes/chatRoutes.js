const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// User
router.get('/my-messages', requireAuth, chatController.getMyMessages);
router.post('/my-messages', requireAuth, chatController.sendMessage);
router.get('/my-unread-count', requireAuth, chatController.getMyUnreadCount);

// Admin
router.get('/admin/conversations', requireAuth, requireAdmin, chatController.adminListConversations);
router.get('/admin/conversations/:userId/messages', requireAuth, requireAdmin, chatController.adminGetThread);
router.post('/admin/conversations/:userId/messages', requireAuth, requireAdmin, chatController.adminReply);

module.exports = router;
