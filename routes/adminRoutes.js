import express from 'express';
import * as adminController from '../controllers/adminController.js';
import * as accountController from '../controllers/accountController.js';
import * as settingsController from '../controllers/settingsController.js';
import * as adminManagementController from '../controllers/adminManagementController.js';
import { isAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// The admin service runs on port 8084 and trusts the gateway proxy (x-user-role header).
// However, the monolithic roleMiddleware might still try to read req.user from JWT.
// Let's ensure isAdmin is either compatible or we use a custom check here since we rely on headers.
const enforceAdminHeader = (req, res, next) => {
  const role = req.user?.role || req.headers['x-user-role'];
  if (role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  next();
};

router.use(enforceAdminHeader);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/overdue', adminController.getOverdueLoans);
router.get('/applications', adminController.getPendingApplications);
router.get('/applications/:id', adminController.getApplicationDetails);
router.get('/settings/activity-logs/export', settingsController.exportActivityLogsCSV);
router.get('/settings/administrators/:id', adminManagementController.getAdministrator);
router.get('/settings/administrators', adminManagementController.listAdministrators, settingsController.getSettingsPage);
router.post('/settings/administrators', adminManagementController.createAdministrator);
router.put('/settings/administrators/:id/status', adminManagementController.changeStatus);
router.put('/settings/administrators/:id/password', adminManagementController.resetPassword);
router.put('/settings/administrators/:id', adminManagementController.updateAdministrator);
router.delete('/settings/administrators/:id', adminManagementController.deleteAdministrator);
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

router.get('/account/transactions/export', accountController.exportTransactionsCSV);
router.get('/account/transactions', accountController.getTransactions);
router.get('/account', accountController.showAccount);
router.post('/account/add-funds', accountController.addFunds);
router.post('/account/credit', accountController.addFunds);

export default router;
