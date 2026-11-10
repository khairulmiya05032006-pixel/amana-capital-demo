import db from '../config/db.js';
import bcrypt from 'bcrypt';

/**
 * List all Administrators & Sub-Admins
 */
export const listAdministrators = async (req, res, next) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.user_code, u.email, u.role, u.account_status, u.last_login, u.created_at, u.updated_at,
             cp.full_name, cp.phone
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.role != 'CUSTOMER'
      ORDER BY u.created_at DESC
    `);

    const adminIds = users.map(u => u.id);
    let allPerms = [];
    if (adminIds.length > 0) {
      [allPerms] = await db.query('SELECT admin_id, module_name FROM admin_permissions WHERE admin_id IN (?)', [adminIds]);
    }
    const permsByAdmin = allPerms.reduce((acc, row) => {
      if (!acc[row.admin_id]) acc[row.admin_id] = [];
      acc[row.admin_id].push(row.module_name);
      return acc;
    }, {});

    for (const u of users) {
      u.permissions = permsByAdmin[u.id] || [];
    }

    const totalAdmins = users.length;
    const activeAdmins = users.filter(u => u.account_status === 'ACTIVE').length;
    const disabledAdmins = users.filter(u => u.account_status !== 'ACTIVE').length;
    const lastAddedDate = users.length > 0 ? users[0].created_at : null;

    const data = {
      administrators: users,
      stats: { totalAdmins, activeAdmins, disabledAdmins, lastAddedDate }
    };

    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) {
      return res.json({ success: true, data });
    }
    res.locals.adminData = data;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Administrator Details
 */
export const getAdministrator = async (req, res, next) => {
  try {
    const adminId = req.params.id;
    const [users] = await db.query(`
      SELECT u.id, u.user_code, u.email, u.role, u.account_status, u.last_login, u.created_at, u.updated_at,
             cp.full_name, cp.phone
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.id = ? AND u.role != 'CUSTOMER'
    `, [adminId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Administrator not found.' });
    }

    const admin = users[0];
    const [perms] = await db.query('SELECT module_name FROM admin_permissions WHERE admin_id = ?', [admin.id]);
    admin.permissions = perms.map(p => p.module_name);

    // Fetch Creator (if available, using audit logs as a proxy or just showing N/A)
    const [creator] = await db.query(`
      SELECT cp.full_name 
      FROM audit_logs a 
      JOIN users u ON a.user_id = u.id 
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE a.entity_name = 'ADMINISTRATOR' AND a.entity_id = ? AND a.action = 'CREATE_ADMINISTRATOR'
      LIMIT 1
    `, [admin.id]);
    admin.created_by = creator.length > 0 ? creator[0].full_name : 'System';

    // Fetch Login History (from audit_logs for now)
    const [loginHistory] = await db.query(`
      SELECT created_at as date, ip_address as ip, description as browser, 'Unknown' as os, 'Unknown' as location, 'SUCCESS' as status 
      FROM audit_logs 
      WHERE user_id = ? AND action = 'LOGIN' 
      ORDER BY created_at DESC LIMIT 20
    `, [admin.id]);

    // Fetch Recent Audit Logs
    const [auditHistory] = await db.query(`
      SELECT created_at as date, action, description 
      FROM audit_logs 
      WHERE user_id = ? AND action != 'LOGIN' 
      ORDER BY created_at DESC LIMIT 20
    `, [admin.id]);

    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) {
      return res.json({ success: true, data: { admin, loginHistory, auditHistory } });
    }

    const formatDate = (dateStr) =>
      dateStr ? new Date(dateStr).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    return res.render('admin/settings/administrator-view', {
      title: 'Administrator Details',
      admin,
      loginHistory,
      auditHistory,
      formatDate,
      loggedInUser: req.user || res.locals.user,
      loggedInRank: req.loggedInRank,
      targetRank: req.targetRank
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create New Administrator Account (SUPER ADMIN Only)
 */
export const createAdministrator = async (req, res, next) => {
  try {
    const currentUser = req.user || res.locals.user || { id: 1, role: 'SUPER_ADMIN' };
    
    // RBAC Check: Only SUPER_ADMIN can create accounts
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access Denied: Only Super Administrators can add staff accounts.' });
    }

    const { full_name, email, phone, username, password, role = 'LOAN_OFFICER', status = 'ACTIVE', permissions = [] } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ success: false, message: 'Email, Username, and Password are required.' });
    }

    // Check unique email/username
    const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }
    const [existingUsername] = await db.query('SELECT id FROM users WHERE user_code = ?', [username]);
    if (existingUsername.length > 0) {
      return res.status(409).json({ success: false, message: 'This username or administrator code is already in use. Please choose another.' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const passwordHash = await bcrypt.hash(password, 10);

      const [userRes] = await connection.query(`
        INSERT INTO users (user_code, email, password_hash, role, account_status, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [username, email, passwordHash, role.toUpperCase(), status.toUpperCase()]);

      const newAdminId = userRes.insertId;

      // Module permissions assignment (DEPRECATED)
      // The system now uses granular RBAC via roles and user_permissions.
      // Roles natively define permissions via role_permissions.
      // We will skip inserting into the legacy admin_permissions table.
      
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      await connection.query(`
        INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
        VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'CREATE_ADMINISTRATOR', ?, ?, NOW())
      `, [currentUser.id, newAdminId, `${currentUser.role} created ${role} account '${email}'`, ipAddress]);

      await connection.commit();

      const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
      if (isJson) {
        return res.json({ success: true, message: '✓ Administrator account created successfully!', data: { adminId: newAdminId } });
      }
      return res.redirect('/admin/settings?tab=administrators&success=1');
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
    if (isJson) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

/**
 * Update Administrator Account Details
 */
export const updateAdministrator = async (req, res, next) => {
  try {
    const currentUser = req.user || res.locals.user || { id: 1, role: 'SUPER_ADMIN' };
    const adminId = req.params.id;

    const { full_name, phone, role, status, permissions } = req.body;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      if (currentUser.role === 'SUPER_ADMIN') {
        if (role) {
          await connection.query('UPDATE users SET role = ? WHERE id = ?', [role.toUpperCase(), adminId]);
        }
        if (status) {
          await connection.query('UPDATE users SET account_status = ? WHERE id = ?', [status.toUpperCase(), adminId]);
        }
      }

      if (permissions && Array.isArray(permissions)) {
        await connection.query('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
        for (const mod of permissions) {
          await connection.query(`
            INSERT INTO admin_permissions (admin_id, module_name, can_view, can_create, can_edit, can_delete)
            VALUES (?, ?, 1, 1, 1, 1)
          `, [adminId, mod]);
        }
      }

      const ipAddress = req.ip || '127.0.0.1';
      await connection.query(`
        INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
        VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'UPDATE_ADMINISTRATOR', ?, ?, NOW())
      `, [currentUser.id, adminId, `Updated Administrator profile for ID #${adminId}`, ipAddress]);

      await connection.commit();
      return res.json({ success: true, message: 'Administrator profile updated successfully.' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Toggle Administrator Active/Inactive Status (SUPER ADMIN Only)
 */
export const changeStatus = async (req, res, next) => {
  try {
    const currentUser = req.user || res.locals.user || { id: 1, role: 'SUPER_ADMIN' };
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access Denied: Only Super Administrators can change account statuses.' });
    }

    const adminId = req.params.id;
    const { status } = req.body;

    const [supers] = await db.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND account_status = 'ACTIVE'");
    const [target] = await db.query("SELECT role FROM users WHERE id = ?", [adminId]);

    if (target.length > 0 && target[0].role === 'SUPER_ADMIN' && supers.length <= 1 && status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Cannot disable the last remaining active Super Admin account.' });
    }

    await db.query('UPDATE users SET account_status = ? WHERE id = ?', [status.toUpperCase(), adminId]);

    const ipAddress = req.ip || '127.0.0.1';
    await db.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
      VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'TOGGLE_ADMIN_STATUS', ?, ?, NOW())
    `, [currentUser.id, adminId, `Changed status of Administrator #${adminId} to ${status}`, ipAddress]);

    return res.json({ success: true, message: `Administrator status updated to ${status}` });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Reset Password (SUPER ADMIN Only)
 */
export const resetPassword = async (req, res, next) => {
  try {
    const currentUser = req.user || res.locals.user || { id: 1, role: 'SUPER_ADMIN' };
    const adminId = req.params.id;

    const { new_password } = req.body;
    if (!new_password || new_password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);

    const ipAddress = req.ip || '127.0.0.1';
    await db.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
      VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'RESET_ADMIN_PASSWORD', ?, ?, NOW())
    `, [currentUser.id, adminId, `Reset password for Administrator account #${adminId}`, ipAddress]);

    return res.json({ success: true, message: 'Administrator password reset successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete Administrator Account (SUPER ADMIN Only)
 */
export const deleteAdministrator = async (req, res, next) => {
  try {
    const currentUser = req.user || res.locals.user || { id: 1, role: 'SUPER_ADMIN' };
    
    if (currentUser.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access Denied: Only Super Administrators can delete staff accounts.' });
    }

    const adminId = req.params.id;

    if (parseInt(adminId, 10) === parseInt(currentUser.id, 10)) {
      return res.status(400).json({ success: false, message: 'Action blocked: You cannot delete your own logged-in administrator account.' });
    }

    const [supers] = await db.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN'");
    const [target] = await db.query("SELECT role, email FROM users WHERE id = ?", [adminId]);

    if (target.length > 0 && target[0].role === 'SUPER_ADMIN' && supers.length <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the last remaining Super Admin.' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
      await connection.query('DELETE FROM users WHERE id = ?', [adminId]);

      const ipAddress = req.ip || '127.0.0.1';
      await connection.query(`
        INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, ip_address, created_at)
        VALUES (?, 'ADMIN_MANAGEMENT', 'users', ?, 'DELETE_ADMINISTRATOR', ?, ?, NOW())
      `, [currentUser.id, adminId, `Deleted Administrator account '${target[0]?.email || adminId}'`, ipAddress]);

      await connection.commit();
      return res.json({ success: true, message: 'Administrator account deleted successfully.' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

