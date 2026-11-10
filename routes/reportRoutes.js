// Report Routes
import express from 'express';
import * as reportController from '../controllers/reportController.js';

const router = express.Router();

router.get('/dashboard', reportController.getDashboardReport);
router.get('/overdue-loans', reportController.getOverdueLoansReport);
router.get('/collection', reportController.getCollectionReport);
router.get('/customer-summary/:customerId', reportController.getCustomerSummaryReport);
router.get('/monthly/:year/:month', reportController.generateMonthlyReport);
router.get('/admin-reports', reportController.getAdminReportsDashboard);
router.get('/export/csv/collections', reportController.exportCollectionsCSV);
router.get('/export/csv/overdue', reportController.exportOverdueCSV);

export default router;
