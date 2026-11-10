import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ═══════════════════════════════════════════════════════════════════════════
//  HOST IT SMART CONNECTION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const TARGET_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 30000,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
//  LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(msg, color = COLORS.reset) {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false });
  console.log(`${COLORS.bright}[${timestamp}]${COLORS.reset} ${color}${msg}${COLORS.reset}`);
}

function logSuccess(msg) { log(`✅ ${msg}`, COLORS.green); }
function logWarn(msg) { log(`⚠️  ${msg}`, COLORS.yellow); }
function logError(msg) { log(`❌ ${msg}`, COLORS.red); }
function logInfo(msg) { log(`ℹ️  ${msg}`, COLORS.cyan); }

// ═══════════════════════════════════════════════════════════════════════════
//  SQL EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

async function executeSqlFile(filePath, connection) {
  let sql = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  
  // Strip out forbidden statements for shared hosting environments (cPanel)
  // Host IT Smart already created the DB and user, we cannot CREATE DATABASE or USE other DBs.
  sql = sql.replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/ig, '');
  sql = sql.replace(/DROP DATABASE IF EXISTS[\s\S]*?;/ig, '');
  sql = sql.replace(/USE defaultdb;/ig, '');
  sql = sql.replace(/USE microfinance_db;/ig, '');
  sql = sql.replace(/USE microfinance;/ig, '');

  if (sql.includes('DELIMITER $$')) {
    // Handle files with DELIMITER (Stored Procedures, Triggers, Events)
    // mysql2 does not support the DELIMITER keyword as it's a CLI command.
    const blocks = sql.split('$$');
    for (let block of blocks) {
      block = block.replace(/DELIMITER\s*;/g, '').replace(/DELIMITER/g, '').trim();
      if (block) {
        try {
          await connection.query(block);
        } catch (err) {
          throw new Error(`Error executing block in ${path.basename(filePath)}:\n${err.message}\nBlock preview: ${block.substring(0, 100)}...`);
        }
      }
    }
  } else {
    // Normal SQL file (Schema, Indexes, Seeds)
    if (sql.trim()) {
      try {
        await connection.query(sql);
      } catch (err) {
        throw new Error(`Error executing file ${path.basename(filePath)}:\n${err.message}`);
      }
    }
  }
}

async function runDirectory(dirPath, connection) {
  const fullPath = path.resolve(__dirname, 'database', dirPath);
  try {
    const files = await fs.readdir(fullPath);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort(); // Sort alphabetically to respect 001_, 002_ ordering

    if (sqlFiles.length === 0) {
      logWarn(`No SQL files found in database/${dirPath}`);
      return;
    }

    logInfo(`Running ${sqlFiles.length} files from database/${dirPath}...`);
    
    for (const file of sqlFiles) {
      process.stdout.write(`   ↳ Executing ${file}... `);
      await executeSqlFile(path.join(fullPath, file), connection);
      console.log(`${COLORS.green}OK${COLORS.reset}`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      logWarn(`Directory database/${dirPath} does not exist, skipping.`);
    } else {
      throw err;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN MIGRATION ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

async function migrate() {
  log(`\n╔════════════════════════════════════════════════════════════╗`, COLORS.cyan);
  log(`║  AMANAH CAPITAL — Database Initialization & Migration      ║`, COLORS.cyan);
  log(`║  Target: Host IT Smart (${TARGET_CONFIG.host})               ║`, COLORS.cyan);
  log(`╚════════════════════════════════════════════════════════════╝\n`, COLORS.cyan);

  let pool = null;

  try {
    logInfo(`Connecting to ${TARGET_CONFIG.user}@${TARGET_CONFIG.host}:${TARGET_CONFIG.port}/${TARGET_CONFIG.database}...`);
    pool = mysql.createPool(TARGET_CONFIG);
    const connection = await pool.getConnection();
    const [version] = await connection.query('SELECT VERSION() as v');
    logSuccess(`Connected successfully! MySQL Version: ${version[0].v}\n`);

    // Disable foreign key checks for the initialization
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');
    await connection.query("SET NAMES 'utf8mb4'");

    // Execution Pipeline
    const directoriesToRun = [
      'schema',
      'migration',
      'indexes',
      'views',
      'functions',
      'procedures',
      'triggers',
      'events',
      'seed'
    ];

    for (const dir of directoriesToRun) {
      await runDirectory(dir, connection);
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();

    logSuccess(`\n🎉 DATABASE INITIALIZATION COMPLETE!`);
    logInfo(`Your Host IT Smart database is fully set up and ready to use.`);

  } catch (err) {
    logError(`\nMIGRATION FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

migrate();
