import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const useSSL = String(process.env.DB_USE_SSL ?? "false").toLowerCase() === "true";
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16510,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {})
  });

  try {
    console.log("Starting deletion of all customer data...");
    
    await connection.query(`
      SET FOREIGN_KEY_CHECKS = 0;
      TRUNCATE TABLE notifications_log;
      TRUNCATE TABLE loan_transactions;
      TRUNCATE TABLE payments;
      TRUNCATE TABLE loan_installments;
      TRUNCATE TABLE loan_status_history;
      TRUNCATE TABLE loans;
      TRUNCATE TABLE loan_applications;
      TRUNCATE TABLE customer_profiles;
      DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE role = 'CUSTOMER');
      DELETE FROM users WHERE role = 'CUSTOMER';
      SET FOREIGN_KEY_CHECKS = 1;
    `);

    console.log("Successfully wiped all customer details from the database!");
  } catch (err) {
    console.error("Error wiping data:", err.message);
  } finally {
    connection.destroy();
  }
}

main();
