// Role-based Authorization Middleware
import { ROLES } from '../config/constants.js';

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: Insufficient permissions',
      });
    }
    next();
  };
};

export const isAdmin = (req, res, next) => {
  const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER', 'COLLECTION_OFFICER', 'ACCOUNT_OFFICER', 'AUDITOR', 'VIEWER'];
  if (!req.user || !adminRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden: Admin role required',
    });
  }
  next();
};

export const isCustomer = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.CUSTOMER) {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden: Customer role required',
    });
  }
  next();
};
