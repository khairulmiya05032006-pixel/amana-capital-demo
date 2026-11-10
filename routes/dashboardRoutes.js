// Dashboard API Routes
import express from 'express';
import { getDashboardSummary, getRecentLoans, getUpcomingPayments } from '../controllers/dashboardController.js';
import { isCustomer } from '../middleware/roleMiddleware.js';

const router = express.Router();

// All routes require customer role
router.use(isCustomer);

router.get('/summary', getDashboardSummary);
router.get('/recent-loans', getRecentLoans);
router.get('/upcoming-payments', getUpcomingPayments);

export default router;
