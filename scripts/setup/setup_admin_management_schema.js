import db from './config/db.js';

async function setupAdminManagementSchema() {
  console.log('=== SETTING UP ADMIN MANAGEMENT SCHEMA ===');

  try {
    // 1. Create admin_roles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[SCHEMA] Created or verified `admin_roles` table.');

    // 2. Insert default roles
    const defaultRoles = [
      ['SUPER_ADMIN', 'Full system and administrator management access'],
      ['ADMIN', 'Full business operations except administrator management'],
      ['LOAN_OFFICER', 'Applications, Loans & Disbursal management'],
      ['COLLECTION_OFFICER', 'Repayments and Customer management'],
      ['ACCOUNT_OFFICER', 'Treasury account balance and Financial Reports'],
      ['AUDITOR', 'Read-only access to Reports and Activity Audit Logs'],
      ['VIEWER', 'Read-only access to Dashboard']
    ];

    for (const [rName, desc] of defaultRoles) {
      await db.query(`
        INSERT INTO admin_roles (role_name, description)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description);
      `, [rName, desc]);
    }
    console.log('[SCHEMA] Default admin roles populated.');

    // 3. Create admin_permissions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        admin_id BIGINT UNSIGNED NOT NULL,
        module_name VARCHAR(100) NOT NULL,
        can_view TINYINT(1) DEFAULT 1,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_admin_module (admin_id, module_name),
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[SCHEMA] Created or verified `admin_permissions` table.');

    // 4. Update users.role and audit_logs.action columns to VARCHAR(50)
    try {
      await db.query(`
        ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'ADMIN';
      `);
      await db.query(`
        ALTER TABLE audit_logs MODIFY COLUMN action VARCHAR(50) NOT NULL;
      `);
      console.log('[SCHEMA] Updated `users.role` and `audit_logs.action` columns to VARCHAR(50).');
    } catch (e) {
      console.warn('[SCHEMA WARN]', e.message);
    }

    // 5. Ensure primary admin user (ID 1) has SUPER_ADMIN role
    await db.query(`
      UPDATE users SET role = 'SUPER_ADMIN' WHERE id = 1 OR role = 'ADMIN' LIMIT 1;
    `);
    console.log('[SCHEMA] Promoted primary admin user to SUPER_ADMIN.');

    console.log('=== ADMIN MANAGEMENT SCHEMA SETUP COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('[SCHEMA FAIL]', error.message);
    process.exit(1);
  }
}

setupAdminManagementSchema();
