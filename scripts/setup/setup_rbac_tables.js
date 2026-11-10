import db from './config/db.js';

async function setupRbacTables() {
  console.log('=== SETTING UP RBAC TABLES ===');

  try {
    // 1. Create `roles` table
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[RBAC] Verified `roles` table.');

    // 2. Create `permissions` table
    await db.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_key VARCHAR(100) UNIQUE NOT NULL,
        description VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[RBAC] Verified `permissions` table.');

    // 3. Create `role_permissions` table
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        UNIQUE KEY unique_role_perm (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[RBAC] Verified `role_permissions` table.');

    // 4. Create `user_permissions` table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        permission_id INT NOT NULL,
        allowed TINYINT(1) DEFAULT 1,
        UNIQUE KEY unique_user_perm (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[RBAC] Verified `user_permissions` table.');

    // Seed roles
    const rolesList = [
      ['SUPER_ADMIN', 'Super Administrator with full system & staff management access'],
      ['LOAN_OFFICER', 'Loan Officer with access to Applications, Loans & Disbursal'],
      ['COLLECTION_OFFICER', 'Collection Officer with access to Repayments & Customers'],
      ['ACCOUNT_OFFICER', 'Account Officer with access to Account Balance & Reports'],
      ['AUDITOR', 'Auditor with read-only access to Reports & Audit Logs'],
      ['VIEWER', 'Viewer with read-only Dashboard access']
    ];

    for (const [rName, rDesc] of rolesList) {
      await db.query(`
        INSERT INTO roles (role_name, description)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description);
      `, [rName, rDesc]);
    }

    // Seed permissions
    const permsList = [
      ['Dashboard', 'View executive dashboard summary'],
      ['Account Balance', 'Manage treasury capital & add funds'],
      ['Applications', 'View & process loan applications'],
      ['Customers', 'View & manage customer profiles'],
      ['Loans & Disbursal', 'View & manage loan disbursals'],
      ['Repayments', 'Receive & record loan repayments'],
      ['Reports', 'View & export financial reports'],
      ['Penalty Settings', 'Configure late fee penalty rates'],
      ['Settings', 'Configure system & profile settings'],
      ['Administrator Management', 'Create, edit & manage sub-administrators']
    ];

    for (const [pKey, pDesc] of permsList) {
      await db.query(`
        INSERT INTO permissions (permission_key, description)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description);
      `, [pKey, pDesc]);
    }

    console.log('=== RBAC TABLES SETUP COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('[RBAC FAIL]', error.message);
    process.exit(1);
  }
}

setupRbacTables();
