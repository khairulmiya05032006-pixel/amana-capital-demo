// Loan Application Routes — permission-based RBAC
import express from 'express';
import * as loanAppController from '../controllers/loanApplicationController.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ── Read routes ───────────────────────────────────────────────
router.get('/',   requirePermission('applications.view'), loanAppController.getAllApplications);
router.get('/:id', requirePermission('applications.view'), loanAppController.getApplicationById);

// ── Write routes (customers) ──────────────────────────────────
router.post('/', loanAppController.createApplication);

// ── Admin action routes (permission-gated) ────────────────────
router.post('/:id/approve', requirePermission('applications.approve'), loanAppController.approveApplication);
router.post('/:id/reject',  requirePermission('applications.reject'),  loanAppController.rejectApplication);

export default router;

