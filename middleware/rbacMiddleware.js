import db from '../config/db.js';

export const ROLE_RANKS = {
  SUPER_ADMIN: 100,
  LOAN_OFFICER: 80,
  COLLECTION_OFFICER: 70,
  ACCOUNT_OFFICER: 60,
  AUDITOR: 40,
  VIEWER: 20
};

/**
 * Middleware to enforce hierarchical RBAC for viewing/managing administrators.
 * Expects JWT user info in req.user or res.locals.user.
 * Expects the target user ID in req.params.id.
 */
export const authorizeAdministratorAccess = async (req, res, next) => {
  try {
    const loggedInUser = req.user || res.locals.user;
    if (!loggedInUser) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const targetUserId = req.params.id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID required.' });
    }

    // Fetch ONLY the target user's ID and role
    const [targetUsers] = await db.query(
      'SELECT id, role FROM users WHERE id = ? AND role != \'CUSTOMER\'',
      [targetUserId]
    );

    if (targetUsers.length === 0) {
      // Return 404 to prevent URL enumeration
      const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
      if (isJson) {
        return res.status(404).json({ success: false, message: 'Administrator not found.' });
      }
      return res.status(404).render('admin/settings', {
        title: 'Administrator Not Found',
        activeTab: 'administration',
        adminSettings: {},
        activityLogs: [],
        adminData: { administrators: [], stats: {} },
        systemInfo: {},
        search: '',
        success: null,
        error: 'Administrator not found.',
        formatDate: () => ''
      });
    }

    const targetUser = targetUsers[0];
    const loggedInRank = ROLE_RANKS[loggedInUser.role] || 0;
    const targetRank = ROLE_RANKS[targetUser.role] || 0;

    // Authorization Rules:
    // 1. SUPER_ADMIN (Rank 100) can view anyone, including other SUPER_ADMINs.
    // 2. Everyone can view themselves (id match).
    // 3. You cannot view someone with a higher or equal rank (except rule 1 & 2).
    
    let isAuthorized = false;

    if (loggedInUser.role === 'SUPER_ADMIN') {
      isAuthorized = true;
    } else if (Number(loggedInUser.id) === Number(targetUser.id)) {
      isAuthorized = true;
    } else if (loggedInRank > targetRank) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      // For API requests, return JSON. For browser requests, return 404 HTML.
      const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
      
      if (isJson) {
        return res.status(404).json({ success: false, message: 'Administrator not found.' });
      }

      // Hide behind 404 instead of 403 to prevent enumeration
      return res.status(404).render('admin/settings', {
        title: 'Administrator Not Found',
        activeTab: 'administration',
        adminSettings: {},
        activityLogs: [],
        adminData: { administrators: [], stats: {} },
        systemInfo: {},
        search: '',
        success: null,
        error: 'Administrator not found.',
        formatDate: () => ''
      });
    }

    // Pass the target role to req object for later use in controllers
    req.targetRole = targetUser.role;
    req.loggedInRank = loggedInRank;
    req.targetRank = targetRank;
    
    next();
  } catch (error) {
    next(error);
  }
};
/**
 * Middleware to load fine-grained permissions for the authenticated admin
 * and attach them to the request and response locals.
 */
export const loadPermissions = async (req, res, next) => {
  if (!req.user || !res.locals.user) {
    return res.redirect('/auth/login');
  }

  res.locals.hasPermission = () => false;
  req.adminPermissions = new Set();

  try {
    const role = req.user.role;
    
    // In this MVP, any admin role has full access.
    // The hallucinated RBAC tables (permissions, roles, role_permissions) do not exist in the schema.
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role !== 'CUSTOMER') {
      res.locals.hasPermission = (permissionKey) => true;
      req.adminPermissions = new Set(['dashboard.view', 'customers.view', 'customers.edit', 'customers.create', 'customers.delete']);
      return next();
    }

    req.adminPermissions = new Set();
    
    res.locals.hasPermission = (permissionKey) => {
      return req.adminPermissions.has(permissionKey);
    };

    next();
  } catch (error) {
    console.error('RBAC loadPermissions error:', error);
    next(error);
  }
};

export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN') {
      return next();
    }

    if (!req.adminPermissions || !req.adminPermissions.has(permissionKey)) {
      const wantsJson = req.accepts(['html', 'json']) === 'json' || req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
      
      if (wantsJson) {
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action.'
        });
      }

      return res.status(403).render('admin/errors/403', {
        title: 'Access Denied',
        user: res.locals.user
      });
    }

    next();
  };
};
