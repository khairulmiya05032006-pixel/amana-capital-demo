import db from '../../config/db.js';

async function setupAccountSchema() {
  console.log('=== SETTING UP ACCOUNT & TRANSACTION DB SCHEMA ===\n');

  try {
    // 1. Add missing columns to admin_account_transactions if not present
    const [cols] = await db.query('DESCRIBE admin_account_transactions');
    const existingColNames = cols.map(c => c.Field);

    if (!existingColNames.includes('funding_source')) {
      await db.query(`ALTER TABLE admin_account_transactions ADD COLUMN funding_source VARCHAR(100) DEFAULT NULL AFTER amount`);
      console.log('[SCHEMA] Added `funding_source` column to admin_account_transactions');
    }

    if (!existingColNames.includes('payment_method')) {
      await db.query(`ALTER TABLE admin_account_transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT NULL AFTER funding_source`);
      console.log('[SCHEMA] Added `payment_method` column to admin_account_transactions');
    }

    if (!existingColNames.includes('previous_balance')) {
      await db.query(`ALTER TABLE admin_account_transactions ADD COLUMN previous_balance DECIMAL(15,2) DEFAULT NULL AFTER amount`);
      console.log('[SCHEMA] Added `previous_balance` column to admin_account_transactions');
    }

    if (!existingColNames.includes('reference_number')) {
      await db.query(`ALTER TABLE admin_account_transactions ADD COLUMN reference_number VARCHAR(100) DEFAULT NULL AFTER reference`);
      console.log('[SCHEMA] Added `reference_number` column to admin_account_transactions');
    }

    // 2. Expand transaction_type ENUM if needed to allow 'FUND_DEPOSIT' or 'CREDIT'
    await db.query(`ALTER TABLE admin_account_transactions MODIFY COLUMN transaction_type ENUM('CREDIT', 'DEBIT', 'FUND_DEPOSIT') NOT NULL DEFAULT 'CREDIT'`);
    console.log('[SCHEMA] Updated transaction_type ENUM in admin_account_transactions');

    // 3. Expand audit_logs action ENUM to include 'ADD_FUNDS'
    await db.query(`
      ALTER TABLE audit_logs MODIFY COLUMN action 
      ENUM('LOGIN','LOGOUT','CREATE','UPDATE','DELETE','VIEW','APPROVE','REJECT','PAYMENT','EXPORT','IMPORT','BACKUP','RESTORE','DISBURSE','SETTINGS_UPDATE','ADD_FUNDS') NOT NULL
    `);
    console.log('[SCHEMA] Updated action ENUM in audit_logs');

    console.log('\n=== SCHEMA SETUP COMPLETE ===');

  } catch (err) {
    console.error('[SCHEMA ERROR]', err.message);
  }
  process.exit(0);
}

setupAccountSchema();
