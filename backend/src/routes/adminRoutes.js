const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// All routes here require admin auth
router.use(requireAuth, requireAdmin);

router.get('/dashboard-stats', adminController.dashboardStats);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/adjust-balance', adminController.adjustUserBalance);

router.get('/tasks', adminController.listAllTasksAdmin);
router.post('/tasks', adminController.createTask);
router.patch('/tasks/:id', adminController.updateTask);
router.delete('/tasks/:id', adminController.deleteTask);

router.get('/task-submissions', adminController.listSubmissions);
router.post('/task-submissions/:id/review', adminController.reviewSubmission);

module.exports = router;
