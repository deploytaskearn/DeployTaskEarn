const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Public
router.get('/', planController.listPlans);

// Authenticated user
router.get('/my', requireAuth, planController.getMyPlan);
router.get('/my-all', requireAuth, planController.getMyPlans);
router.post('/purchase', requireAuth, planController.purchasePlan);
router.get('/referral-stats', requireAuth, planController.getReferralStats);

// Admin
router.get('/admin', requireAuth, requireAdmin, planController.adminListPlans);
router.post('/admin', requireAuth, requireAdmin, planController.createPlan);
router.patch('/admin/:id', requireAuth, requireAdmin, planController.updatePlan);
router.delete('/admin/:id', requireAuth, requireAdmin, planController.deletePlan);
// Admin: plan task management
router.get('/admin/:id/tasks', requireAuth, requireAdmin, planController.getPlanTasks);
router.post('/admin/:id/tasks', requireAuth, requireAdmin, planController.addPlanTask);
router.delete('/admin/:id/tasks/:taskId', requireAuth, requireAdmin, planController.removePlanTask);

module.exports = router;
