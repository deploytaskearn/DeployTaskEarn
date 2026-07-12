const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Public
router.get('/', planController.listPlans);

// Authenticated user
router.get('/my', requireAuth, planController.getMyPlan);
router.get('/my-all', requireAuth, planController.getMyPlans);
router.get('/my-purchased', requireAuth, planController.getMyPurchasedPlanIds);
router.post('/purchase', requireAuth, planController.purchasePlan);
router.get('/referral-stats', requireAuth, planController.getReferralStats);
router.get('/referral-details', requireAuth, planController.getReferralDetails);

// Admin
router.get('/admin/referrals', requireAuth, requireAdmin, planController.adminGetReferrals);
router.post('/admin/referrals/link', requireAuth, requireAdmin, planController.adminLinkReferral);
router.post('/admin/referrals/link-by-email', requireAuth, requireAdmin, planController.adminLinkReferralByEmail);
router.get('/admin', requireAuth, requireAdmin, planController.adminListPlans);
router.post('/admin', requireAuth, requireAdmin, planController.createPlan);
router.patch('/admin/:id', requireAuth, requireAdmin, planController.updatePlan);
router.delete('/admin/:id', requireAuth, requireAdmin, planController.deletePlan);
// Admin: plan task management
router.get('/admin/:id/tasks', requireAuth, requireAdmin, planController.getPlanTasks);
router.post('/admin/:id/tasks', requireAuth, requireAdmin, planController.addPlanTask);
router.delete('/admin/:id/tasks/:taskId', requireAuth, requireAdmin, planController.removePlanTask);

module.exports = router;
