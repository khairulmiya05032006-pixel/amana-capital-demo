import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main () {
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
    let spSql = await fs.readFile("../database/procedures/sp_approve_application.sql", "utf-8");
    // Remove DELIMITER commands
    spSql = spSql.replace(/DELIMITER \$\$/g, '').replace(/DELIMITER ;/g, '');
    
    // Split by $$ to get individual statements
    const statements = spSql.split('$$').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const stmt of statements) {
        await connection.query(stmt);
    }
    
    console.log("Stored procedure updated successfully.");
  } catch (err) {
    console.error("Error updating SP:", err);
  } finally {
    await connection.end();
  }
}

main();
