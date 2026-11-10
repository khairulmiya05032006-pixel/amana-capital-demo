import express from 'express';
import * as schemeController from '../controllers/schemeController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// API Endpoint for preview (can be called by loan officers during approval)
router.get('/api/schemes/:id/preview', verifyToken, isAdmin, requirePermission('applications.approve'), schemeController.previewSchedule);

// Admin UI Routes
router.get('/admin/schemes', verifyToken, isAdmin, requirePermission('schemes.view'), schemeController.listSchemes);
router.get('/admin/schemes/create', verifyToken, isAdmin, requirePermission('schemes.create'), schemeController.showCreateForm);
router.post('/admin/schemes', verifyToken, isAdmin, requirePermission('schemes.create'), schemeController.createScheme);
router.get('/admin/schemes/:id', verifyToken, isAdmin, requirePermission('schemes.view'), schemeController.showSchemeDetails);
router.get('/admin/schemes/:id/edit', verifyToken, isAdmin, requirePermission('schemes.edit'), schemeController.showEditForm);
router.post('/admin/schemes/:id/update', verifyToken, isAdmin, requirePermission('schemes.edit'), schemeController.updateScheme);
router.post('/admin/schemes/:id/clone', verifyToken, isAdmin, requirePermission('schemes.clone'), schemeController.cloneScheme);
router.post('/admin/schemes/:id/status', verifyToken, isAdmin, requirePermission('schemes.disable'), schemeController.changeStatus);

export default router;

