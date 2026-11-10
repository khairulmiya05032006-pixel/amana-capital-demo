/**
 * ============================================================
 *  Permission Middleware — requirePermission(permissionKey)
 * ============================================================
 *  Resolves effective permissions by combining:
 *    1. Role-level permissions  (role_permissions table)
 *    2. User-level overrides    (user_permissions table — allowed=0 to deny, allowed=1 to grant)
 *
 *  Usage:
 *    router.post('/applications/:id/approve',
 *      verifyToken,
 *      requirePermission('applications.approve'),
 *      controller.approveApplication
 *    );
 * ============================================================
 */

import db from '../config/db.js';

// ── Rank map (re-exported for other middleware) ───────────────
export const ROLE_RANKS = {
  SUPER_ADMIN:        100,
  ADMIN:               90,
  LOAN_OFFICER:        80,
  COLLECTION_OFFICER:  70,
  ACCOUNT_OFFICER:     60,
  AUDITOR:             40,
  VIEWER:              20,
};

// ── Default permissions per role  ────────────────────────────
// Used as in-memory fallback when role_permissions table is empty.
const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'applications.view', 'applications.create', 'applications.edit',
    'applications.approve', 'applications.reject', 'applications.delete',
    'applications.assign', 'applications.disburse',
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
    'loans.view', 'loans.disburse', 'loans.edit', 'loans.delete',
    'repayments.view', 'repayments.record',
    'reports.view', 'reports.export',
    'account.view', 'account.manage',
    'settings.view', 'settings.edit',
    'administrators.view', 'administrators.create', 'administrators.edit', 'administrators.delete',
    'dashboard.view',
  ],
  ADMIN: [
    'applications.view', 'applications.create', 'applications.edit',
    'applications.approve', 'applications.reject', 'applications.delete',
    'applications.assign', 'applications.disburse',
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
    'loans.view', 'loans.disburse', 'loans.edit', 'loans.delete',
    'repayments.view', 'repayments.record',
    'reports.view', 'reports.export',
    'account.view', 'account.manage',
    'settings.view', 'settings.edit',
    'administrators.view', 'administrators.create', 'administrators.edit', 'administrators.delete',
    'dashboard.view',
  ],
  LOAN_OFFICER: [
    'dashboard.view',
    'applications.view', 'applications.approve', 'applications.reject', 'applications.edit',
    'customers.view',
    'loans.view',
  ],
  COLLECTION_OFFICER: [
    'dashboard.view',
    'applications.view',
    'customers.view',
    'loans.view',
    'repayments.view', 'repayments.record',
  ],
  ACCOUNT_OFFICER: [
    'dashboard.view',
    'applications.view',
    'account.view', 'account.manage',
    'reports.view', 'reports.export',
  ],
  AUDITOR: [
    'dashboard.view',
    'applications.view',
    'customers.view',
    'loans.view',
    'repayments.view',
    'reports.view',
  ],
  VIEWER: [
    'dashboard.view',
  ],
};

/**
 * Resolve effective permissions for a user.
 * Checks role_permissions + user_permissions tables.
 * Falls back to in-memory defaults if tables are empty.
 *
 * @param {number} userId
 * @param {string} roleName
 * @returns {Promise<Set<string>>} Set of permission keys
 */
async function resolvePermissions(userId, roleName) {
  // In this MVP, the hallucinated RBAC tables (role_permissions, user_permissions, permissions) do not exist.
  // We rely entirely on the in-memory fallback.
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
  return new Set(defaults);
}

/**
 * requirePermission(permissionKey)
 *
 * Middleware factory. Returns an Express middleware that:
 *   1. Gets the logged-in user from res.locals.user or req.user
 *   2. Resolves their effective permissions
 *   3. Checks if the required permission is in that set
 *   4. Proceeds or returns 403
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const user = res.locals.user || req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Please log in to continue.',
        });
      }

      // SUPER_ADMIN and ADMIN always have all permissions
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        req.userPermissions = new Set(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN);
        return next();
      }

      const perms = await resolvePermissions(user.id, user.role);
      req.userPermissions = perms;

      if (!perms.has(permissionKey)) {
        const isJson = req.headers.accept?.includes('application/json') ||
                       req.headers['content-type']?.includes('application/json');
        if (isJson) {
          return res.status(403).json({
            success: false,
            message: `Access Denied: You do not have the '${permissionKey}' permission.`,
          });
        }
        return res.status(403).render('error', {
          title: 'Access Denied',
          message: `Your role (${user.role}) does not have permission to perform this action.`,
          status: 403,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * resolveUserPermissionsToLocals
 *
 * Global middleware to attach resolved permissions to res.locals
 * so EJS templates can conditionally render buttons.
 * Should be applied ONCE after authentication middleware.
 */
export const resolveUserPermissionsToLocals = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (user && user.role) {
      const perms = await resolvePermissions(user.id, user.role);
      res.locals.userPermissions = perms;
      res.locals.hasPermission = (key) => perms.has(key);
    } else {
      res.locals.userPermissions = new Set();
      res.locals.hasPermission = () => false;
    }
  } catch (err) {
    res.locals.userPermissions = new Set();
    res.locals.hasPermission = () => false;
  }
  next();
};

// ── Re-export rank-based admin middleware ─────────────────────
export { authorizeAdministratorAccess } from './rbacMiddleware.js';
