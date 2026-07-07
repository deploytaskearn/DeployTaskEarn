const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const spinController = require('../controllers/spinController');

const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// All routes here require admin auth
router.use(requireAuth, requireAdmin);

router.get('/dashboard-stats', adminController.dashboardStats);

router.get('/users', adminController.listUsers);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/referral-rate', adminController.setReferralRate);
router.post('/users/:id/adjust-balance', adminController.adjustUserBalance);

router.get('/tasks', adminController.listAllTasksAdmin);
router.post('/tasks', adminController.createTask);
router.post('/tasks/bulk', adminController.bulkCreateTasks);
router.patch('/tasks/:id', adminController.updateTask);
router.delete('/tasks/:id', adminController.deleteTask);

router.get('/task-submissions', adminController.listSubmissions);
router.post('/task-submissions/:id/review', adminController.reviewSubmission);

// Spin wheel admin
router.get('/spin/segments', spinController.adminGetSegments);
router.post('/spin/segments', spinController.adminUpsertSegment);
router.delete('/spin/segments/:id', spinController.adminDeleteSegment);
router.get('/spin/codes', spinController.adminGetCodes);
router.post('/spin/codes', spinController.adminCreateCode);
router.patch('/spin/codes/:id/toggle', spinController.adminToggleCode);
router.delete('/spin/codes/:id', spinController.adminDeleteCode);

module.exports = router;
