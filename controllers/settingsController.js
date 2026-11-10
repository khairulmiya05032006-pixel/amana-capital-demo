import db from '../config/db.js';
import * as settingsModel from '../models/settingsModel.js';
import bcrypt from 'bcrypt';
import PenaltyPolicyService from '../services/penaltyPolicyService.js';
import PenaltyService from '../services/penaltyService.js';

/**
 * Settings Controller - Handles System Configuration, Admin Profile, Security, Company Info & Activity Logs
 */

/**
 * Render Admin Settings Page (GET /admin/settings)
 */
export const getSettingsPage = async (req, res, next) => {
  try {
    const activeTab = (req.query.tab || 'general').toLowerCase();
    const search = req.query.search || '';
    const successMsg = req.query.success ? 'Settings updated successfully!' : null;

    const settings = await settingsModel.getSettings(db);
    const penaltySettings = await settingsModel.getPenaltySettings(db);
    const activityLogs = await settingsModel.getActivityLogs(db, search, 100);

    const systemInfo = {
      appVersion: 'v1.0.0',
      dbVersion: 'MySQL 8.0 (Aiven Cloud)',
      buildNumber: '20260724.01',
      environment: process.env.NODE_ENV || 'development',
      license: 'Enterprise Microfinance License',
      supportContact: 'support@amanahcapital.com'
    };

    const formatDate = (dateStr) =>
      dateStr ? new Date(dateStr).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    const adminData = await settingsModel.getAdministrators(db);

    res.render('admin/settings', {
      title: 'Admin Settings & Preferences',
      activeTab,
      adminSettings: settings,
      penaltySettings,
      activityLogs,
      adminData,
      systemInfo,
      search,
      success: successMsg,
      error: null,
      formatDate
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Admin Settings / Profile / Security (POST /admin/settings)
 */
export const updateSettings = async (req, res, next) => {
  try {
    const { section = 'general', current_password, new_password, confirm_password, ...formData } = req.body;
    const userId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';

    // Handle Password Change in Security tab
    if (section === 'security' && (new_password || current_password)) {
      if (!current_password || !new_password || !confirm_password) {
        if (isJson) return res.status(400).json({ success: false, message: 'All password fields are required.' });
        return res.render('admin/settings', {
          title: 'Admin Settings & Preferences',
          activeTab: 'security',
          error: 'All password fields are required.',
          adminSettings: await settingsModel.getSettings(db),
          activityLogs: await settingsModel.getActivityLogs(db, '', 50),
          systemInfo: { appVersion: 'v1.0.0', dbVersion: 'MySQL 8.0', environment: 'production' }
        });
      }

      if (new_password !== confirm_password) {
        if (isJson) return res.status(400).json({ success: false, message: 'New password and confirm password do not match.' });
        return res.render('admin/settings', {
          title: 'Admin Settings & Preferences',
          activeTab: 'security',
          error: 'New password and confirm password do not match.',
          adminSettings: await settingsModel.getSettings(db),
          activityLogs: await settingsModel.getActivityLogs(db, '', 50),
          systemInfo: { appVersion: 'v1.0.0', dbVersion: 'MySQL 8.0', environment: 'production' }
        });
      }

      if (new_password.length < 6) {
        if (isJson) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      }

      // Verify current password from DB
      const [userRows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
      if (userRows.length > 0 && userRows[0].password_hash) {
        const matches = await bcrypt.compare(current_password, userRows[0].password_hash);
        if (!matches) {
          if (isJson) return res.status(401).json({ success: false, message: 'Your current password is incorrect. Please try again.' });
          // Fallback if not JSON
          const [settings] = await settingsModel.getAllSettingsGrouped(db);
          return res.status(401).render('admin/settings', { title: 'Settings', settings, activeTab: 'security', error: 'Your current password is incorrect. Please try again.' });
        }
      }

      // Hash and update user password
      const newHash = await bcrypt.hash(new_password, 10);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
      formData.last_password_change = new Date().toISOString();
    }

    // Save configuration settings
    await settingsModel.updateSettings(db, section, formData, userId, ipAddress);

    if (isJson) {
      return res.json({ success: true, message: `✓ ${section.toUpperCase()} settings updated successfully!` });
    } else {
      return res.redirect(`/admin/settings?tab=${section}&success=1`);
    }
  } catch (error) {
    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

/**
 * Export Activity Logs to CSV (GET /admin/settings/activity-logs/export)
 */
export const exportActivityLogsCSV = async (req, res, next) => {
  try {
    const logs = await settingsModel.getActivityLogs(db, req.query.search || '', 500);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=admin_activity_logs_${Date.now()}.csv`);

    let csv = 'ID,Date,User,Action,Module,Description,IP Address\n';
    logs.forEach(log => {
      const dateStr = log.created_at ? new Date(log.created_at).toISOString() : '';
      const desc = (log.description || '').replace(/"/g, '""');
      csv += `"${log.id}","${dateStr}","${log.user_email || log.user_id}","${log.action}","${log.module_name}","${desc}","${log.ip_address || '127.0.0.1'}"\n`;
    });

    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Create Administrator (POST /admin/settings/administrators)
 */
export const createAdministrator = async (req, res, next) => {
  try {
    const creatorId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settingsModel.addAdministrator(db, req.body, creatorId, ipAddress);

    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) {
      return res.json({ success: true, message: '✓ Administrator created successfully!', data: result });
    }
    return res.redirect('/admin/settings?tab=administrators&success=1');
  } catch (error) {
    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

/**
 * Toggle Administrator Status (PUT /admin/settings/administrators/:id/status)
 */
export const toggleAdminStatus = async (req, res, next) => {
  try {
    const adminId = req.params.id;
    const { status } = req.body;
    const updaterId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || '127.0.0.1';

    const result = await settingsModel.toggleAdministratorStatus(db, adminId, status, updaterId, ipAddress);
    return res.json({ success: true, message: `Administrator status updated to ${status}`, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete Administrator (DELETE /admin/settings/administrators/:id)
 */
export const deleteAdministrator = async (req, res, next) => {
  try {
    const adminId = req.params.id;
    const deleterId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || '127.0.0.1';

    const result = await settingsModel.deleteAdministrator(db, adminId, deleterId, ipAddress);
    return res.json({ success: true, message: 'Administrator account deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Update Penalty Settings (POST /admin/settings/penalties)
 */
export const updatePenalties = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const userId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    
    // Validate request body
    const { DAILY, WEEKLY, MONTHLY } = req.body;
    if (!DAILY || !WEEKLY || !MONTHLY) {
      throw new Error("Missing frequency configuration blocks.");
    }
    
    // Update the penalty policies via the new service
    await PenaltyPolicyService.updatePolicies(connection, req.body, userId, ipAddress);
    
    // Synchronize active eligible overdue installments with the new policy
    await PenaltyService.syncUnpostedPenalties(connection);
    
    await connection.commit();

    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) {
      return res.json({ success: true, message: 'Penalty settings updated successfully!' });
    }
    return res.redirect('/admin/settings?tab=penalty&success=1');
  } catch (error) {
    await connection.rollback();
    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) return res.status(400).json({ success: false, message: error.message });
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Get Penalty Settings Default for a specific frequency (GET /admin/settings/penalties/defaults)
 */
export const getPenaltyDefaults = async (req, res, next) => {
  try {
    const frequency = req.query.frequency;
    if (!frequency) {
      return res.status(400).json({ success: false, message: "Frequency is required" });
    }
    const [rows] = await db.query('SELECT * FROM penalty_settings WHERE repayment_frequency = ?', [frequency]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No settings found for frequency" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

