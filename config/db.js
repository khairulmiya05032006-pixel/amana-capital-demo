import mysql from "mysql2/promise";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from repository root (one level above config/). This ensures
// scripts run from subfolders (e.g., scripts/) still find the same env file.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db_use_ssl = String(process.env.DB_USE_SSL ?? "false").toLowerCase() === "true";
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || "20", 10);

const db_connection_pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true,
  charset: 'utf8mb4',
  ...(db_use_ssl ? { ssl: { rejectUnauthorized: false } } : {}),
});


export default db_connection_pool;
