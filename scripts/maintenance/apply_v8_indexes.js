import defaultDb from '../../config/db.js';
import mysql from 'mysql2/promise';

async function getDbConnection() {
  const targetDb = process.argv[2];
  if (targetDb) {
    console.log(`Connecting to specified database: ${targetDb}...`);
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: targetDb
    });
    return pool.getConnection();
  }
  return defaultDb.getConnection();
}

async function addIndexIfNotExists(connection, table, indexName, columns) {
  try {
    const [rows] = await connection.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
    if (rows.length === 0) {
      console.log(`Adding index ${indexName} on ${table}(${columns})...`);
      await connection.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
      console.log(`✅ Index ${indexName} added successfully.`);
    } else {
      console.log(`ℹ️ Index ${indexName} already exists on ${table}.`);
    }
  } catch (err) {
    console.error(`❌ Error adding index ${indexName} on ${table}:`, err.message);
    throw err;
  }
}

async function runV8Migration() {
  console.log('================================================================');
  console.log('  APPLYING V8 PRODUCTION PERFORMANCE INDEXES');
  console.log('================================================================\n');

  const connection = await getDbConnection();

  try {
    const indexDefinitions = [
      // 1. Loans
      { table: 'loans', index: 'idx_loans_status', cols: '`loan_status`' },
      { table: 'loans', index: 'idx_loans_disbursement_date', cols: '`disbursement_date`' },
      { table: 'loans', index: 'idx_loans_customer_status', cols: '`customer_id`, `loan_status`' },

      // 2. Loan Installments
      { table: 'loan_installments', index: 'idx_installments_status', cols: '`installment_status`' },
      { table: 'loan_installments', index: 'idx_installments_due_date', cols: '`due_date`' },
      { table: 'loan_installments', index: 'idx_installments_status_due', cols: '`installment_status`, `due_date`' },
      { table: 'loan_installments', index: 'idx_installments_loan_status', cols: '`loan_id`, `installment_status`' },

      // 3. Payments
      { table: 'payments', index: 'idx_payments_date', cols: '`payment_date`' },
      { table: 'payments', index: 'idx_payments_loan_date', cols: '`loan_id`, `payment_date`' },
      { table: 'payments', index: 'idx_payments_method', cols: '`payment_method`' },

      // 4. Loan Applications
      { table: 'loan_applications', index: 'idx_applications_status', cols: '`application_status`' },
      { table: 'loan_applications', index: 'idx_applications_created', cols: '`created_at`' },
      { table: 'loan_applications', index: 'idx_applications_customer_status', cols: '`customer_id`, `application_status`' },

      // 5. Audit Logs
      { table: 'audit_logs', index: 'idx_audit_created', cols: '`created_at`' },
      { table: 'audit_logs', index: 'idx_audit_module_created', cols: '`module_name`, `created_at`' },

      // 6. Customer Profiles
      { table: 'customer_profiles', index: 'idx_customer_created', cols: '`created_at`' },

      // 7. Penalties
      { table: 'penalties', index: 'idx_penalties_status', cols: '`status`' },

      // 8. Loan Transactions
      { table: 'loan_transactions', index: 'idx_transactions_date', cols: '`transaction_date`' },
      { table: 'loan_transactions', index: 'idx_transactions_type', cols: '`transaction_type`' },

      // 9. Admin Account Transactions
      { table: 'admin_account_transactions', index: 'idx_admin_created', cols: '`created_at`' },
      { table: 'admin_account_transactions', index: 'idx_admin_txn_type', cols: '`transaction_type`' }
    ];

    for (const item of indexDefinitions) {
      await addIndexIfNotExists(connection, item.table, item.index, item.cols);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL V8 PERFORMANCE INDEXES SUCCESSFULLY VERIFIED & APPLIED!');
    console.log('================================================================\n');
  } finally {
    connection.release();
    process.exit(0);
  }
}

runV8Migration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
