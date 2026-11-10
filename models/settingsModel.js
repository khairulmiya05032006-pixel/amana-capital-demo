import db from '../config/db.js';

/**
 * Settings Model - Handles Admin Settings, Preferences, Company Info & Activity Logs
 */

/**
 * Default System Settings Fallback Dictionary
 */
const DEFAULT_SETTINGS = {
  // General
  time_zone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  currency: 'INR (₹)',
  language: 'English (US)',

  // My Profile
  full_name: 'Admin User',
  email: 'admin@microfinance.com',
  mobile_number: '+91 9876543210',
  designation: 'Senior Treasury Administrator',
  profile_photo: '',

  // Security
  two_factor_auth: 'DISABLED',
  last_login: new Date().toISOString(),
  active_sessions_count: 1,

  // Company Information
  company_name: 'Amanah Capital Microfinance Ltd.',
  registration_number: 'U65923MH2021PLC356123',
  gst_number: '27AABCA1234F1ZB',
  pan_number: 'AABCA1234F',
  address: 'Suite 402, Financial District, Bandra Kurla Complex',
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  postal_code: '400051',
  company_logo: '/brand-logo/AMANATH_CAPITAL_Logo-removebg-preview.png',

  // Notifications
  email_notifications: 'ENABLED',
  sms_notifications: 'ENABLED',
  browser_notifications: 'ENABLED',
  payment_alerts: 'ENABLED',
  loan_alerts: 'ENABLED',
  daily_summary: 'ENABLED',

  // Appearance
  compact_layout: 'DISABLED',
  fixed_sidebar: 'ENABLED',
  fixed_header: 'ENABLED',
  default_landing_page: '/admin/dashboard',
  table_density: 'Comfortable',

  // Penalty Settings
  penalty_rate: '2.00',
  penalty_grace_period: '5',
  penalty_calc_method: 'Percentage on Overdue Amount',
  auto_apply_penalty: 'ENABLED',
  penalty_max_cap: '10.00',

  // System Preferences
  session_timeout: '30 Minutes',
  auto_logout: 'ENABLED',
  default_page_size: '25 Rows',
  file_upload_limit: '10 MB',
  backup_frequency: 'Daily'
};

/**
 * Fetch all system settings as a key-value dictionary
 */
export const getSettings = async (pool = db) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = { ...DEFAULT_SETTINGS };

    rows.forEach(r => {
      if (r.setting_key && r.setting_value !== null) {
        settings[r.setting_key] = r.setting_value;
      }
    });

    return settings;
  } catch (error) {
    // Return default settings if table is being initialized
    return DEFAULT_SETTINGS;
  }
};

/**
 * Update system settings for a section
 */
export const updateSettings = async (pool = db, section, data, userId = 1, ipAddress = '127.0.0.1') => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updatedKeys = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === 'current_password' || key === 'new_password' || key === 'confirm_password') continue;
      
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // Check if setting exists
      const [existing] = await connection.query('SELECT setting_key FROM system_settings WHERE setting_key = ?', [key]);

      if (existing.length > 0) {
        await connection.query('UPDATE system_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?', [valStr, userId, key]);
      } else {
        await connection.query('INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at) VALUES (?, ?, ?, NOW())', [key, valStr, userId]);
      }
      updatedKeys.push(key);
    }

    // Log update in audit_logs
    await connection.query(`
      INSERT INTO audit_logs (
        user_id, module_name, entity_name, action, description, ip_address, created_at
      ) VALUES (?, 'SETTINGS', 'system_settings', 'UPDATE', ?, ?, NOW())
    `, [
      userId,
      `Updated ${section.toUpperCase()} settings: ${updatedKeys.join(', ')}`,
      ipAddress
    ]);

    await connection.commit();
    return { success: true, updatedKeys };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Fetch penalty settings for all frequencies
 */
export const getPenaltySettings = async (pool = db) => {
  try {
    const [rows] = await pool.query('SELECT * FROM penalty_settings');
    const penaltySettings = {};
    rows.forEach(r => {
      penaltySettings[r.repayment_frequency] = r;
    });
    return penaltySettings;
  } catch (error) {
    console.error("Error fetching penalty settings:", error);
    return {};
  }
};

/**
 * Update penalty settings
 */
export const updatePenaltySettings = async (pool = db, data, userId = 1, ipAddress = '127.0.0.1') => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
    
    for (const freq of frequencies) {
      if (data[freq]) {
        const config = data[freq];
        await connection.query(`
          INSERT INTO penalty_settings 
          (repayment_frequency, penalty_rate, fixed_penalty_amount, grace_period_days, calculation_method, auto_apply, maximum_penalty_cap, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
            penalty_rate = VALUES(penalty_rate),
            fixed_penalty_amount = VALUES(fixed_penalty_amount),
            grace_period_days = VALUES(grace_period_days),
            calculation_method = VALUES(calculation_method),
            auto_apply = VALUES(auto_apply),
            maximum_penalty_cap = VALUES(maximum_penalty_cap),
            updated_by = VALUES(updated_by),
            updated_at = NOW()
        `, [
          freq,
          config.penalty_rate || 0,
          config.fixed_penalty_amount || 0,
          config.grace_period_days || 0,
          config.calculation_method || 'PERCENTAGE_OF_OVERDUE',
          config.auto_apply === 'ENABLED' || config.auto_apply === 'true',
          config.maximum_penalty_cap || 0,
          userId
        ]);
      }
    }

    // Log update in audit_logs
    await connection.query(`
      INSERT INTO audit_logs (
        user_id, module_name, entity_name, action, description, ip_address, created_at
      ) VALUES (?, 'SETTINGS', 'penalty_settings', 'UPDATE', ?, ?, NOW())
    `, [
      userId,
      'Updated Frequency-Based Penalty Settings',
      ipAddress
    ]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Fetch Activity Audit Logs
 */
export const getActivityLogs = async (pool = db, search = '', limit = 50) => {
  try {
    let query = `
      SELECT a.*, u.email AS user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
    `;
    const params = [];

    if (search && search.trim() !== '') {
      query += ` WHERE a.module_name LIKE ? OR a.action LIKE ? OR a.description LIKE ? OR u.email LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(limit);

    const [logs] = await pool.query(query, params);
    return logs;
  } catch (error) {
    return [];
  }
};

/**
 * Fetch all Administrators & Sub-Admins with permissions & stats
 */
export const getAdministrators = async (pool = db) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.user_code, u.email, u.role, u.account_status, u.last_login, u.created_at, u.updated_at,
             cp.full_name, cp.phone
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.role != 'CUSTOMER'
      ORDER BY u.created_at DESC
    `);

    // Fetch permissions for each admin
    // The admin_permissions table does not exist in the MVP schema.
    for (const u of users) {
      u.permissions = u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' ? ['all'] : [];
    }

    const totalAdmins = users.length;
    const activeAdmins = users.filter(u => u.account_status === 'ACTIVE').length;
    const disabledAdmins = users.filter(u => u.account_status !== 'ACTIVE').length;
    const lastAddedDate = users.length > 0 ? users[0].created_at : null;

    return {
      administrators: users,
      stats: {
        totalAdmins,
        activeAdmins,
        disabledAdmins,
        lastAddedDate
      }
    };
  } catch (error) {
    throw new Error(`Error fetching administrators: ${error.message}`);
  }
};

/**
 * Create new Administrator / Sub-Admin account
 */
export const addAdministrator = async (pool = db, data, creatorId = 1, ipAddress = '127.0.0.1') => {
  const { full_name, email, phone, username, password, role = 'ADMIN', status = 'ACTIVE', permissions = [] } = data;

  if (!email || !password || !username) {
    throw new Error('Email, Username, and Password are required to create an administrator account.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if email or username exists
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? OR user_code = ?', [email, username]);
    if (existing.length > 0) {
      throw new Error('An account with this Email Address or Username already exists.');
    }

    // Hash password
    const bcrypt = (await import('bcrypt')).default;
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [userRes] = await connection.query(`
      INSERT INTO users (user_code, email, password_hash, role, account_status, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [username, email, passwordHash, role.toUpperCase(), status.toUpperCase()]);

    const newAdminId = userRes.insertId;

    // Save module permissions
    const modules = Array.isArray(permissions) ? permissions : [permissions];
    for (const mod of modules) {
      if (mod && mod.trim()) {
        await connection.query(`
          INSERT INTO admin_permissions (admin_id, module_name, can_view, can_create, can_edit, can_delete)
          VALUES (?, ?, 1, 1, 1, 1)
          ON DUPLICATE KEY UPDATE can_view = 1
        `, [newAdminId, mod.trim()]);
      }
    }

    // Log in audit_logs
    await connection.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
      VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'CREATE_ADMINISTRATOR', ?, ?, NOW())
    `, [creatorId, newAdminId, `Created Administrator account '${email}' with role ${role}`, ipAddress]);

    await connection.commit();
    return { success: true, adminId: newAdminId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Toggle Administrator Active/Inactive Status
 */
export const toggleAdministratorStatus = async (pool = db, adminId, newStatus, updaterId = 1, ipAddress = '127.0.0.1') => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Prevent disabling last remaining SUPER_ADMIN
    const [supers] = await connection.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND account_status = 'ACTIVE'");
    const [target] = await connection.query("SELECT role FROM users WHERE id = ?", [adminId]);
    
    if (target.length > 0 && target[0].role === 'SUPER_ADMIN' && supers.length <= 1 && newStatus !== 'ACTIVE') {
      throw new Error('Action blocked: Cannot disable the last remaining active Super Admin account.');
    }

    await connection.query('UPDATE users SET account_status = ? WHERE id = ?', [newStatus, adminId]);

    await connection.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
      VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'TOGGLE_ADMIN_STATUS', ?, ?, NOW())
    `, [updaterId, adminId, `Updated Administrator status for ID #${adminId} to ${newStatus}`, ipAddress]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Delete Administrator Account
 */
export const deleteAdministrator = async (pool = db, adminId, deleterId = 1, ipAddress = '127.0.0.1') => {
  if (parseInt(adminId, 10) === parseInt(deleterId, 10)) {
    throw new Error('Action blocked: You cannot delete your own logged-in administrator account.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check last SUPER_ADMIN
    const [supers] = await connection.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN'");
    const [target] = await connection.query("SELECT role, email FROM users WHERE id = ?", [adminId]);
    
    if (target.length > 0 && target[0].role === 'SUPER_ADMIN' && supers.length <= 1) {
      throw new Error('Action blocked: Cannot delete the last remaining Super Admin account.');
    }

    const email = target[0]?.email || adminId;

    await connection.query('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
    await connection.query('DELETE FROM users WHERE id = ?', [adminId]);

    await connection.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
      VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'DELETE_ADMINISTRATOR', ?, ?, NOW())
    `, [deleterId, adminId, `Deleted Administrator account '${email}' (ID #${adminId})`, ipAddress]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

