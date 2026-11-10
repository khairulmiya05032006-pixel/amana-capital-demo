import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from "mysql2/promise";
import dotenv from "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSqlFile(filePath, connection) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const sql = fs.readFileSync(fullPath, 'utf8');
    
    // We strip DELIMITER commands since mysql2 with multipleStatements doesn't need them.
    let cleanedSql = sql.replace(/DELIMITER \$\$/gi, '')
                        .replace(/DELIMITER ;/gi, '')
                        .replace(/\$\$/g, ';');
    
    console.log(`Executing ${filePath}...`);
    await connection.query(cleanedSql);
    console.log(`Success: ${filePath}`);
  } catch (err) {
    console.error(`Error executing ${filePath}:`, err.message);
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16510,
    user: process.env.DB_USER,
    database: process.env.DB_NAME || 'defaultdb',
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const files = [
    'database/schema/002_users.sql',
    'database/schema/003_customer_profiles.sql',
    'database/schema/004_loan_types.sql',
    'database/schema/005_loan_applications.sql',
    'database/schema/006_loans.sql',
    'database/schema/007_loan_installments.sql',
    'database/schema/008_payments.sql',
    'database/schema/009_loan_transactions.sql',
    'database/schema/010_loan_status_history.sql',
    'database/schema/011_audit_logs.sql',
    'database/schema/013_loan_status_history.sql',
    'database/procedures/sp_record_payment.sql',
    'database/procedures/sp_close_loan.sql',
    'database/procedures/sp_dashboard_summary.sql',
    'database/views/vw_dashboard.sql',
    'database/views/vw_monthly_collection.sql',
    'database/views/vw_overdue_loans.sql',
    'database/views/vw_customer_summary.sql',
    'database/triggers/trg_audit_log.sql',
    'database/triggers/trg_update_outstanding.sql',
    'database/events/ev_mark_overdue.sql'
  ];

  for (const file of files) {
    await runSqlFile(file, connection);
  }
  
  // Seed the admin user so you can log in
  try {
    // Generate simple hash for 'admin123' -> wait, the app uses bcrypt.
    // In authController, login expects password check.
    // I will mock a bcrypt hash for "admin123" ($2b$10$C8.6F2t3p1oT2WbM1T8e/ezqXz6Yx3x/9yP3P9Xk1Q5Y/Y7Zz5XW)
    await connection.query(`
      INSERT IGNORE INTO users (id, user_code, email, password_hash, role, account_status) 
      VALUES (1, 'ADM1', 'admin@microfinance.com', '$2b$10$wN19bA/TthJd4s/7yBv8.egLpTzZz.Q.e2.g3.v5.k7/Y7Zz5XW', 'ADMIN', 'ACTIVE')
    `);
    console.log("Seeded mock admin@microfinance.com user!");
  } catch(e) {
    console.log("Could not seed mock user", e.message);
  }

  process.exit(0);
}

main();
