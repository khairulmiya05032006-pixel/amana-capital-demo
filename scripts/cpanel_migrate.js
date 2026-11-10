import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const requiredEnv = ['DB_USER', 'DB_NAME', 'DB_PASSWORD'];
const missing = requiredEnv.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`\x1b[31m[ERROR] Missing required database environment variables: ${missing.join(', ')}\x1b[0m`);
  console.error(`Please make sure your .env file is configured correctly.`);
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  charset: 'utf8mb4',
  ...(String(process.env.DB_USE_SSL ?? 'false').toLowerCase() === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
};

async function runMigration() {
  console.log(`\n======================================================`);
  console.log(`🚀 Amanah Capital - Fresh Database Migration Tool`);
  console.log(`======================================================`);
  console.log(`Target Host:     ${dbConfig.host}:${dbConfig.port}`);
  console.log(`Target Database: ${dbConfig.database}`);
  console.log(`Target User:     ${dbConfig.user}`);
  console.log(`------------------------------------------------------`);

  const sqlFilePath = path.resolve(__dirname, '../database/cpanel_fresh_migration.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`\x1b[31m[ERROR] Migration file not found: ${sqlFilePath}\x1b[0m`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  let connection;

  try {
    console.log(`Connecting to database...`);
    connection = await mysql.createConnection(dbConfig);
    console.log(`\x1b[32m✔ Connected successfully.\x1b[0m`);

    console.log(`Executing migration script (this may take a few seconds)...`);
    const startTime = Date.now();
    await connection.query(sqlContent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\x1b[32m✔ Migration SQL executed successfully in ${duration}s.\x1b[0m`);

    // Verification
    console.log(`\nVerifying database state...`);
    const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const [views] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    const [adminUser] = await connection.query("SELECT id, user_code, email, role FROM users WHERE role = 'ADMIN' LIMIT 1");
    const [schemes] = await connection.query("SELECT COUNT(*) as count FROM loan_schemes");
    const [penalties] = await connection.query("SELECT COUNT(*) as count FROM penalty_settings");

    console.log(`✔ Base Tables Created:  ${tables.length} / 19`);
    console.log(`✔ Views Created:        ${views.length}`);
    console.log(`✔ Active Loan Schemes:  ${schemes[0].count}`);
    console.log(`✔ Penalty Configurations: ${penalties[0].count}`);
    if (adminUser.length > 0) {
      console.log(`✔ Default Super Admin:  ${adminUser[0].email} (User Code: ${adminUser[0].user_code})`);
    }

    console.log(`\n======================================================`);
    console.log(`\x1b[32m🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!\x1b[0m`);
    console.log(`Default Super Admin Credentials:`);
    console.log(`  Email:    admin@microfinance.com`);
    console.log(`  Password: Admin@123`);
    console.log(`======================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n\x1b[31m[ERROR] Migration failed:\x1b[0m`, error.message);
    if (error.sqlMessage) console.error(`MySQL Message: ${error.sqlMessage}`);
    if (error.sql) console.error(`Failed Query Snippet: ${error.sql.substring(0, 150)}...`);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
