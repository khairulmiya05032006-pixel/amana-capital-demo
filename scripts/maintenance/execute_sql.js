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
    let cleanedSql = sql.replace(/DELIMITER \$\$/gi, '').replace(/DELIMITER ;/gi, '').replace(/\$\$/g, ';');
    
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
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  const files = [
    'database/views/vw_dashboard.sql'
  ];

  for (const file of files) {
    await runSqlFile(file, connection);
  }
  process.exit(0);
}

main();
