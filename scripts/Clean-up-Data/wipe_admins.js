import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });
console.log('Loaded env:', { envPath, DB_HOST: process.env.DB_HOST, DB_PORT: process.env.DB_PORT, DB_NAME: process.env.DB_NAME });

async function main() {
  const useSSL = String(process.env.DB_USE_SSL ?? "false").toLowerCase() === "true";
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    console.log("Starting admin & customer data cleanup, preserving one SUPER_ADMIN...");
    // Identify a SUPER_ADMIN to keep (first found)
    const [adminRows] = await connection.query(
      `SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1`
    );
    if (adminRows.length === 0) {
      throw new Error("No SUPER_ADMIN found – aborting cleanup to avoid deleting all admin accounts.");
    }
    const superAdminId = adminRows[0].id;

    await connection.query(`
      SET FOREIGN_KEY_CHECKS = 0;
      -- Preserve the identified SUPER_ADMIN, delete everything else
      DELETE FROM users WHERE id <> ?;
      DELETE FROM customer_profiles;
      DELETE FROM loans;
      DELETE FROM loan_applications;
      DELETE FROM loan_installments;
      DELETE FROM loan_transactions;
      DELETE FROM payments;
      DELETE FROM loan_status_history;
      DELETE FROM audit_logs WHERE user_id <> ?;
      DELETE FROM notifications_log;
      SET FOREIGN_KEY_CHECKS = 1;
    `, [superAdminId, superAdminId]);

    console.log("Cleanup complete. Preserved SUPER_ADMIN id:", superAdminId);
  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await connection.end();
  }
}

main();
