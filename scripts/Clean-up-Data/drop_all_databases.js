import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const protectedDatabases = new Set([
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
  "test",
]);

function usage() {
  console.log("Usage:");
  console.log("  node scripts/Clean-up-Data/drop_all_databases.js --force");
  console.log("  or");
  console.log("  DROP_ALL_DATABASES=true node scripts/Clean-up-Data/drop_all_databases.js");
}

async function main() {
  const shouldForce = process.argv.includes("--force") || process.env.DROP_ALL_DATABASES === "true";

  if (!shouldForce) {
    console.error("This script drops every non-system database on the MySQL server.");
    console.error("It is destructive and should only be used intentionally.");
    usage();
    process.exit(1);
  }

  const rootUser = process.env.DB_ROOT_USER || process.env.DB_USER;
  const rootPassword = process.env.DB_ROOT_PASSWORD || process.env.DB_PASSWORD;

  if (!rootUser || !rootPassword) {
    console.error("Missing DB_ROOT_USER / DB_ROOT_PASSWORD (or DB_USER / DB_PASSWORD) in .env");
    process.exit(1);
  }

  const useSSL = String(process.env.DB_USE_SSL ?? "false").toLowerCase() === "true";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: rootUser,
    password: rootPassword,
    database: "mysql",
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    const [rows] = await connection.query("SHOW DATABASES");
    const databases = rows
      .map((row) => Object.values(row)[0])
      .filter((db) => !protectedDatabases.has(db));

    if (databases.length === 0) {
      console.log("No non-system databases found to drop.");
      return;
    }

    console.log("Databases to drop:");
    for (const dbName of databases) {
      console.log(` - ${dbName}`);
    }

    for (const dbName of databases) {
      console.log(`Dropping database: ${dbName}`);
      await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      console.log(`Dropped: ${dbName}`);
    }

    console.log("All non-system databases were dropped successfully.");
  } catch (error) {
    console.error("Failed to drop databases:", error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
