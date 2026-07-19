const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Public
router.get('/blog', cmsController.listPublishedPosts);
router.get('/blog/:slug', cmsController.getPostBySlug);
router.post('/contact', cmsController.submitContactMessage);
router.get('/settings', cmsController.getSettings);
router.get('/categories', cmsController.listCategories);
router.get('/help-videos', cmsController.listHelpVideos);

// Admin
router.get('/admin/blog', requireAuth, requireAdmin, cmsController.adminListPosts);
router.post('/admin/blog', requireAuth, requireAdmin, cmsController.createPost);
router.patch('/admin/blog/:id', requireAuth, requireAdmin, cmsController.updatePost);
router.delete('/admin/blog/:id', requireAuth, requireAdmin, cmsController.deletePost);

router.get('/admin/contact-messages', requireAuth, requireAdmin, cmsController.adminListContactMessages);
router.patch('/admin/contact-messages/:id/read', requireAuth, requireAdmin, cmsController.adminMarkContactRead);

router.post('/admin/settings', requireAuth, requireAdmin, cmsController.updateSetting);
router.post('/admin/settings/bulk', requireAuth, requireAdmin, cmsController.bulkUpdateSettings);
router.post('/admin/categories', requireAuth, requireAdmin, cmsController.createCategory);

router.get('/admin/help-videos', requireAuth, requireAdmin, cmsController.adminListHelpVideos);
router.post('/admin/help-videos', requireAuth, requireAdmin, cmsController.createHelpVideo);
router.patch('/admin/help-videos/:id', requireAuth, requireAdmin, cmsController.updateHelpVideo);
router.delete('/admin/help-videos/:id', requireAuth, requireAdmin, cmsController.deleteHelpVideo);

module.exports = router;
