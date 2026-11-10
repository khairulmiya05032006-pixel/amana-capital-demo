/**
 * ============================================================
 *  DATA CLEANUP SCRIPT — Microfinance Loan Application
 *  File: Clean-up-Data/wipe_transactional_data.js
 * ============================================================
 *
 *  WHAT THIS SCRIPT DOES:
 *    1. Wipes all transactional data (loans, payments, applications,
 *       installments, transactions, status histories, notifications).
 *    2. Resets the admin account balance to Rs 0.
 *    3. Deletes all audit logs and admin activity logs.
 *    4. Deletes all customer profiles and customer user accounts.
 *
 *  WHAT IS PRESERVED (untouched):
 *    - System schema / table structure
 *    - Admin / staff user accounts (users with role != CUSTOMER)
 *    - Admin permissions, roles, role_permissions
 *    - Loan types (product catalogue)
 *    - System settings (penalty config, app config)
 *
 *  HOW TO RUN:
 *    1. Stop all microservices first:
 *         taskkill /F /IM node.exe
 *    2. From the project root, run:
 *         node Clean-up-Data/wipe_transactional_data.js
 *    3. Restart services:
 *         .\run-all.ps1
 * ============================================================
 */

import db from '../../config/db.js';

const connection = await db.getConnection();

try {
  console.log('\n Cleaning transactional data...\n');

  // Step 1: Disable FK checks
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  console.log('OK  Foreign key checks disabled');

  // Step 2: Wipe all transactional tables
  const transactionalTables = [
    'admin_account_transactions',
    'loan_transactions',
    'payments',
    'loan_installments',
    'loan_status_history',
    'application_status_history',
    'loans',
    'loan_applications',
    'notifications_log',
    'audit_logs',
  ];

  for (const table of transactionalTables) {
    await connection.query(`DELETE FROM \`${table}\``);
    await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    console.log(`OK  Cleared: ${table}`);
  }

  // Step 3: Delete customer profiles then customer users
  await connection.query(`
    DELETE cp FROM customer_profiles cp
    WHERE cp.user_id IN (
      SELECT id FROM (SELECT id FROM users WHERE role = 'CUSTOMER') AS sub
    )
  `);
  console.log('OK  Cleared: customer_profiles');

  await connection.query(`DELETE FROM users WHERE role = 'CUSTOMER'`);
  console.log('OK  Cleared: users (customers only, admin accounts preserved)');

  await connection.query(`ALTER TABLE customer_profiles AUTO_INCREMENT = 1`);
  await connection.query(`ALTER TABLE users AUTO_INCREMENT = 2`);

  // Step 4: Reset admin account balance to 0
  await connection.query(`UPDATE admin_account SET balance = 0.00, updated_at = NOW()`);
  console.log('OK  Reset: admin_account balance to 0');

  // Step 5: Re-enable FK checks
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('OK  Foreign key checks restored');

  // Step 6: Verification
  console.log('\n--- Post-cleanup verification ---');
  const checks = [
    ['loan_applications', 'Applications'],
    ['loans',             'Loans'],
    ['payments',          'Payments'],
    ['loan_installments', 'Installments'],
    ['loan_transactions', 'Loan Transactions'],
    ['audit_logs',        'Audit Logs'],
    ['customer_profiles', 'Customer Profiles'],
    ['users',             'Total Users (admins only)'],
  ];

  for (const [table, label] of checks) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
    console.log(`  ${label.padEnd(26)}: ${row.cnt} rows`);
  }

  const [[acct]] = await connection.query('SELECT balance FROM admin_account LIMIT 1');
  console.log(`  ${'Admin Account Balance'.padEnd(26)}: ${acct.balance}`);

  console.log('\nDONE. The application is ready to use.\n');

} catch (err) {
  try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
  console.error('\nFAILED:', err.message);
  process.exit(1);
} finally {
  connection.release();
  process.exit(0);
}
