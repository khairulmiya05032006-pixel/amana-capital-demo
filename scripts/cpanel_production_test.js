/**
 * ============================================================================
 * AMANAH CAPITAL — cPanel Production Readiness & Environment Test Suite
 * ============================================================================
 * Specifically designed for cPanel / CloudLinux / Phusion Passenger hosting.
 * Validates:
 *   1. Node.js runtime and production environment configuration (.env)
 *   2. Filesystem permissions & Passenger restart file (tmp/restart.txt)
 *   3. MySQL/MariaDB connectivity, latency, and pool limits
 *   4. All 19 production tables, V8 performance indexes, and flat-interest columns
 *   5. Seed data integrity (Super Admin, schemes, penalty settings, liquidity)
 *   6. Express HTTP server, GET /health, security headers, and static caching
 *   7. Cron job runners and automated maintenance scripts
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from repository root
dotenv.config({ path: path.join(rootDir, '.env') });

// ANSI Color Helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warningChecks = 0;

function pass(title, details = '') {
  totalChecks++;
  passedChecks++;
  console.log(`  ${c.green}✔ PASS${c.reset}  ${title} ${details ? c.gray + '(' + details + ')' + c.reset : ''}`);
}

function warn(title, advice = '') {
  totalChecks++;
  warningChecks++;
  console.log(`  ${c.yellow}⚠ WARN${c.reset}  ${title}`);
  if (advice) console.log(`         ${c.yellow}└─ Advice: ${advice}${c.reset}`);
}

function fail(title, error = '', remediation = '') {
  totalChecks++;
  failedChecks++;
  console.log(`  ${c.red}✖ FAIL${c.reset}  ${title}`);
  if (error) console.log(`         ${c.red}└─ Error: ${error}${c.reset}`);
  if (remediation) console.log(`         ${c.cyan}└─ Fix:   ${remediation}${c.reset}`);
}

function header(title) {
  console.log(`\n${c.bold}${c.blue}▶ ${title}${c.reset}`);
  console.log(`${c.gray}${'─'.repeat(68)}${c.reset}`);
}

async function runProductionTests() {
  const startTime = Date.now();

  console.log(`\n${c.bold}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  AMANAH CAPITAL — cPanel Production Deployment Test Suite${c.reset}`);
  console.log(`${c.bold}======================================================================${c.reset}`);
  console.log(`  Timestamp:   ${new Date().toISOString()}`);
  console.log(`  Node Engine: ${process.version} (${process.arch} / ${process.platform})`);
  console.log(`  App Path:    ${rootDir}`);

  // ==========================================================================
  // SECTION 1: Node.js Runtime & cPanel Environment Configuration
  // ==========================================================================
  header('1. Node.js Runtime & Environment Configuration (.env)');

  // 1.1 Node Version check
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor >= 20) {
    pass('Node.js Version Check', `v${process.versions.node} - Optimal LTS`);
  } else if (nodeMajor >= 18) {
    pass('Node.js Version Check', `v${process.versions.node} - Supported LTS`);
  } else {
    fail('Node.js Version Check', `v${process.versions.node} is below recommended v18+`, 'Select Node 20.x in cPanel "Setup Node.js App".');
  }

  // 1.2 .env file existence
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    pass('.env File Existence', envPath);
  } else {
    fail('.env File Existence', 'Missing .env file in root directory', 'Copy .env.example to .env and configure your cPanel database details.');
  }

  // 1.3 NODE_ENV validation
  if (process.env.NODE_ENV === 'production') {
    pass('NODE_ENV Setting', 'production (View caching & compression enabled)');
  } else {
    warn('NODE_ENV Setting', `Currently set to "${process.env.NODE_ENV || 'undefined'}". Set NODE_ENV=production in .env for production optimization.`);
  }

  // 1.4 Critical Database Environment Variables
  const requiredDbEnv = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingDbEnv = requiredDbEnv.filter((k) => !process.env[k]);
  if (missingDbEnv.length === 0) {
    pass('Database Environment Variables', `DB_HOST=${process.env.DB_HOST}, DB_NAME=${process.env.DB_NAME}, DB_USER=${process.env.DB_USER}`);
  } else {
    fail('Database Environment Variables', `Missing variables: ${missingDbEnv.join(', ')}`, 'Define all database connection variables in .env');
  }

  // 1.5 Security Secrets Validation (JWT_SECRET & SESSION_SECRET)
  const insecurePlaceholders = [
    'your-secret-key',
    'your-jwt-secret-key',
    'super_secret_jwt_key_12345',
    'super_secret_session_key_12345',
    'replace_with_strong_random_jwt_secret_minimum_32_characters',
    'replace_with_strong_random_session_secret_minimum_32_characters',
  ];

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret) {
    fail('JWT_SECRET Validation', 'JWT_SECRET is empty', 'Set a strong random 32+ char key in .env');
  } else if (insecurePlaceholders.includes(jwtSecret) || jwtSecret.length < 32) {
    warn('JWT_SECRET Validation', 'JWT_SECRET is using a known placeholder or is under 32 characters. Generate a secure random 64-char hex key.');
  } else {
    pass('JWT_SECRET Validation', `Present and strong (${jwtSecret.length} chars)`);
  }

  const sessionSecret = process.env.SESSION_SECRET || '';
  if (!sessionSecret) {
    fail('SESSION_SECRET Validation', 'SESSION_SECRET is empty', 'Set a strong random 32+ char key in .env');
  } else if (insecurePlaceholders.includes(sessionSecret) || sessionSecret.length < 32) {
    warn('SESSION_SECRET Validation', 'SESSION_SECRET is using a known placeholder or is under 32 characters.');
  } else {
    pass('SESSION_SECRET Validation', `Present and strong (${sessionSecret.length} chars)`);
  }

  // ==========================================================================
  // SECTION 2: Filesystem Permissions & Phusion Passenger Lifecycle
  // ==========================================================================
  header('2. Filesystem Permissions & Passenger Reload Mechanism');

  const requiredDirectories = ['tmp', 'logs', 'storage', 'public/uploads'];
  for (const relDir of requiredDirectories) {
    const fullDir = path.join(rootDir, relDir);
    try {
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }
      // Test write permission
      const probeFile = path.join(fullDir, `.write_probe_${Date.now()}`);
      fs.writeFileSync(probeFile, 'test');
      fs.unlinkSync(probeFile);
      pass(`Writable Directory: ${relDir}/`, 'Read/Write OK');
    } catch (fsErr) {
      fail(`Writable Directory: ${relDir}/`, fsErr.message, `Run "chmod 755 ${relDir}" in cPanel terminal.`);
    }
  }

  // Passenger restart.txt probe
  const restartFile = path.join(rootDir, 'tmp', 'restart.txt');
  try {
    fs.writeFileSync(restartFile, new Date().toISOString());
    pass('Phusion Passenger Reload Mechanism (tmp/restart.txt)', 'Successfully touched');
  } catch (restartErr) {
    fail('Phusion Passenger Reload Mechanism (tmp/restart.txt)', restartErr.message, 'Ensure tmp/ directory exists and is writable by the cPanel user.');
  }

  // ==========================================================================
  // SECTION 3: Database Connectivity & Connection Pool Health
  // ==========================================================================
  header('3. Database Connectivity & Connection Pool Health');

  let dbConnection = null;
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    connectTimeout: 5000,
    ...(String(process.env.DB_USE_SSL ?? 'false').toLowerCase() === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  };

  try {
    const pingStart = Date.now();
    dbConnection = await mysql.createConnection(dbConfig);
    const latency = Date.now() - pingStart;

    if (latency < 50) {
      pass('Database Connectivity & Ping Latency', `${latency}ms - Optimal (<50ms)`);
    } else if (latency < 150) {
      pass('Database Connectivity & Ping Latency', `${latency}ms - Acceptable`);
    } else {
      warn('Database Connectivity & Ping Latency', `High latency: ${latency}ms. Ensure MySQL is local or on a high-speed network.`);
    }

    // Check DB Server Version & Charset
    const [[verRow]] = await dbConnection.query('SELECT VERSION() as ver, @@character_set_database as cs, @@collation_database as col');
    pass('Database Server Engine', `${verRow.ver} (Charset: ${verRow.cs}, Collation: ${verRow.col})`);

    // Check connection limit
    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10);
    if (connectionLimit <= 30) {
      pass('Database Connection Pool Limit', `Limit: ${connectionLimit} (Optimal for cPanel shared hosting)`);
    } else {
      warn('Database Connection Pool Limit', `Limit is ${connectionLimit}. Recommended <= 25-30 on shared hosting to avoid "Too many connections" errors.`);
    }
  } catch (connErr) {
    fail('Database Connection', connErr.message, 'Verify DB credentials in .env. If connecting remotely, ensure cPanel "Remote Database Access Hosts" allows your IP.');
  }

  // ==========================================================================
  // SECTION 4: Database Schema, Tables & Performance Indexes
  // ==========================================================================
  header('4. Database Schema, Tables & Production Indexes');

  if (dbConnection) {
    try {
      const [tables] = await dbConnection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
      const tableNames = tables.map((r) => Object.values(r)[0]);

      const expectedTables = [
        'users',
        'customer_profiles',
        'admin_account',
        'admin_account_transactions',
        'loan_types',
        'loan_schemes',
        'loan_applications',
        'loans',
        'loan_scheme_snapshots',
        'loan_installments',
        'payments',
        'penalties',
        'loan_transactions',
        'loan_status_history',
        'application_status_history',
        'notifications_log',
        'audit_logs',
        'penalty_settings',
        'system_settings',
      ];

      const missingTables = expectedTables.filter((t) => !tableNames.includes(t));
      if (missingTables.length === 0) {
        pass('All 19 Production Base Tables Present', `Found ${tableNames.length} tables in ${process.env.DB_NAME}`);
      } else {
        fail('Production Base Tables Check', `Missing ${missingTables.length} tables: ${missingTables.join(', ')}`, 'Run "npm run migrate" or import database/cpanel_fresh_migration.sql via phpMyAdmin.');
      }

      // Check critical columns for whole-rupee EMI and flat interest
      const [loanCols] = await dbConnection.query("SHOW COLUMNS FROM loans LIKE 'flat_interest_amount'");
      const [loanRoundingCols] = await dbConnection.query("SHOW COLUMNS FROM loans LIKE 'rounding_adjustment'");
      const [instRoundingCols] = await dbConnection.query("SHOW COLUMNS FROM loan_installments LIKE 'rounding_adjustment'");
      const [appRoundingCols] = await dbConnection.query("SHOW COLUMNS FROM loan_applications LIKE 'approved_rounding_adjustment'");
      const [penaltyCols] = await dbConnection.query("SHOW COLUMNS FROM penalty_settings LIKE 'calculation_method'");

      if (
        loanCols.length > 0 &&
        loanRoundingCols.length > 0 &&
        instRoundingCols.length > 0 &&
        appRoundingCols.length > 0 &&
        penaltyCols.length > 0
      ) {
        pass('Financial Architecture Columns', 'Flat interest & whole-rupee rounding adjustment fields verified');
      } else {
        fail('Financial Architecture Columns', 'One or more required financial columns are missing', 'Execute database/cpanel_fresh_migration.sql to update schema.');
      }

      // Check Views (vw_dashboard, vw_customer_summary, etc.)
      const [views] = await dbConnection.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
      const viewNames = views.map((r) => Object.values(r)[0]);
      if (viewNames.includes('vw_dashboard') && viewNames.includes('vw_customer_summary')) {
        pass('Definer-Free Reporting Views', `Present (${viewNames.join(', ')})`);
      } else {
        warn('Reporting Views Check', `Found ${viewNames.length} views. Optional for runtime, but recommended for reporting.`);
      }

      // Check V8 Performance Indexes
      const [loanIndexes] = await dbConnection.query("SHOW INDEX FROM loans WHERE Key_name = 'idx_loans_status'");
      const [instIndexes] = await dbConnection.query("SHOW INDEX FROM loan_installments WHERE Key_name = 'idx_installments_status_due'");
      if (loanIndexes.length > 0 && instIndexes.length > 0) {
        pass('V8 Production Performance Indexes', 'Active loan & overdue installment indexes verified');
      } else {
        warn('V8 Production Performance Indexes', 'Recommended query optimization indexes missing. Run "npm run migrate" to ensure V8 indexes are applied.');
      }
    } catch (schemaErr) {
      fail('Database Schema Validation', schemaErr.message, 'Check database permissions.');
    }
  } else {
    fail('Database Schema Validation', 'Skipped due to database connection failure');
  }

  // ==========================================================================
  // SECTION 5: Seed Data & Administrative Access
  // ==========================================================================
  header('5. Seed Data & Administrative Access');

  if (dbConnection) {
    try {
      // 5.1 Admin User
      const [admins] = await dbConnection.query("SELECT id, user_code, email FROM users WHERE role = 'ADMIN' AND account_status = 'ACTIVE' LIMIT 1");
      if (admins.length > 0) {
        pass('Active Super Admin User Present', `${admins[0].email} (User Code: ${admins[0].user_code})`);
      } else {
        fail('Super Admin User Check', 'No active ADMIN account found in users table', 'Run "npm run migrate" to seed default admin@microfinance.com');
      }

      // 5.2 Active Loan Schemes (DAILY, WEEKLY, MONTHLY)
      const [schemes] = await dbConnection.query("SELECT repayment_frequency, COUNT(*) as count FROM loan_schemes WHERE status = 'ACTIVE' GROUP BY repayment_frequency");
      const schemeFreqs = schemes.map((s) => s.repayment_frequency);
      if (schemeFreqs.includes('DAILY') && schemeFreqs.includes('WEEKLY') && schemeFreqs.includes('MONTHLY')) {
        pass('Loan Schemes Coverage', 'All 3 frequencies configured (DAILY, WEEKLY, MONTHLY)');
      } else {
        warn('Loan Schemes Coverage', `Found active schemes for: ${schemeFreqs.join(', ') || 'None'}. Expected DAILY, WEEKLY, and MONTHLY.`);
      }

      // 5.3 Penalty Settings by Frequency
      const [penalties] = await dbConnection.query("SELECT repayment_frequency, calculation_method, version FROM penalty_settings WHERE is_active = 1");
      if (penalties.length >= 3) {
        pass('Penalty Policies Configured', `${penalties.length} active frequency policies verified`);
      } else {
        warn('Penalty Policies Check', `Found ${penalties.length} active penalty policies. Expected 3.`);
      }

      // 5.4 Admin Liquidity Account
      const [adminAcc] = await dbConnection.query('SELECT balance FROM admin_account LIMIT 1');
      if (adminAcc.length > 0) {
        pass('Admin Liquidity Float Initialized', `Current Working Capital: ₹${parseFloat(adminAcc[0].balance).toLocaleString('en-IN')}`);
      } else {
        fail('Admin Liquidity Account', 'admin_account record missing', 'Run "npm run migrate" to initialize float balance.');
      }
    } catch (seedErr) {
      fail('Seed Data Validation', seedErr.message);
    }
  } else {
    fail('Seed Data Validation', 'Skipped due to database connection failure');
  }

  // ==========================================================================
  // SECTION 6: Express HTTP Server, Health Endpoint & Security Headers
  // ==========================================================================
  header('6. Express HTTP Server, Health Endpoint & Security Headers');

  let testServer = null;
  try {
    // Dynamically import Express app
    const { default: app } = await import('../app.js');

    // Spin up an ephemeral HTTP server on a random available port
    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    const assignedPort = testServer.address().port;
    const baseUrl = `http://127.0.0.1:${assignedPort}`;

    pass('Internal HTTP Server Listener', `Bound to 127.0.0.1:${assignedPort}`);

    // Test GET /health
    const healthRes = await fetch(`${baseUrl}/health`);
    if (healthRes.status === 200) {
      const healthData = await healthRes.json();
      pass('GET /health Status', `HTTP 200 OK - status: "${healthData.status}", uptime: ${healthData.uptime}, dbLatency: ${healthData.dbLatency}`);
    } else {
      fail(
        'GET /health Status',
        `HTTP status: ${healthRes.status}`,
        dbConnection ? 'Check app.js /health route handler.' : 'Database is unreachable. Resolve Section 3 database connection first.'
      );
    }

    // Test Security Headers (Helmet, CSP, X-Frame-Options)
    const rootRes = await fetch(`${baseUrl}/health`);
    const csp = rootRes.headers.get('content-security-policy');
    const xContentType = rootRes.headers.get('x-content-type-options');
    const xFrame = rootRes.headers.get('x-frame-options');

    if (xContentType === 'nosniff' && xFrame) {
      pass('Security Headers (Helmet)', `X-Content-Type-Options: ${xContentType}, X-Frame-Options: ${xFrame}`);
    } else {
      warn('Security Headers (Helmet)', 'Helmet security headers missing or incomplete on response.');
    }

    // Test Static Asset Caching Headers
    const staticRes = await fetch(`${baseUrl}/css/admin.css`);
    const cacheHeader = staticRes.headers.get('cache-control');
    const etagHeader = staticRes.headers.get('etag');
    if (staticRes.status === 200 && (cacheHeader || etagHeader)) {
      pass('Static Asset Delivery & Caching', `HTTP ${staticRes.status} (Cache-Control: ${cacheHeader || 'ETag: ' + etagHeader})`);
    } else {
      warn('Static Asset Delivery', `Asset /css/admin.css returned HTTP ${staticRes.status}. Ensure public/ directory exists.`);
    }

    // Test Admin Login Route Rendering
    const loginRes = await fetch(`${baseUrl}/admin/login`);
    if (loginRes.status === 200) {
      pass('Admin Login View Rendering', 'GET /admin/login returned HTTP 200 OK');
    } else {
      fail('Admin Login View Rendering', `GET /admin/login returned HTTP ${loginRes.status}`, 'Check views/admin/login.ejs and route bindings.');
    }
  } catch (httpErr) {
    fail('HTTP Server & Route Testing', httpErr.message, 'Ensure all npm dependencies are installed and app.js has no syntax errors.');
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  }

  // ==========================================================================
  // SECTION 7: Scheduled Maintenance & Cron Job Scripts
  // ==========================================================================
  header('7. Scheduled Maintenance & Cron Job Scripts');

  const penaltyJobPath = path.join(rootDir, 'scripts', 'maintenance', 'run_penalty_job.js');
  if (fs.existsSync(penaltyJobPath)) {
    pass('Automated Penalty Cron Job Script', 'scripts/maintenance/run_penalty_job.js ready');
  } else {
    fail('Automated Penalty Cron Job Script', 'Missing run_penalty_job.js', 'Ensure scripts/maintenance/run_penalty_job.js is present for daily cPanel cron.');
  }

  const migrationSqlPath = path.join(rootDir, 'database', 'cpanel_fresh_migration.sql');
  if (fs.existsSync(migrationSqlPath)) {
    pass('Standalone cPanel SQL Migration File', 'database/cpanel_fresh_migration.sql ready (1-click phpMyAdmin import)');
  } else {
    warn('Standalone cPanel SQL Migration File', 'Missing database/cpanel_fresh_migration.sql');
  }

  const migrationRunnerPath = path.join(rootDir, 'scripts', 'cpanel_migrate.js');
  if (fs.existsSync(migrationRunnerPath)) {
    pass('Automated CLI Migration Runner', 'scripts/cpanel_migrate.js ready (npm run migrate)');
  } else {
    warn('Automated CLI Migration Runner', 'Missing scripts/cpanel_migrate.js');
  }

  // Clean up database connection
  if (dbConnection) {
    await dbConnection.end();
  }

  // ==========================================================================
  // FINAL REPORT & SUMMARY
  // ==========================================================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${c.bold}======================================================================${c.reset}`);
  console.log(`${c.bold}  cPanel PRODUCTION READINESS SUMMARY${c.reset}`);
  console.log(`${c.bold}======================================================================${c.reset}`);
  console.log(`  Total Checks Executed: ${totalChecks}`);
  console.log(`  ${c.green}✔ Passed:${c.reset}  ${passedChecks}`);
  console.log(`  ${c.yellow}⚠ Warnings:${c.reset} ${warningChecks}`);
  console.log(`  ${c.red}✖ Failed:${c.reset}  ${failedChecks}`);
  console.log(`  Execution Time:    ${duration}s\n`);

  if (failedChecks === 0) {
    console.log(`${c.bold}${c.green}🎉 ALL PRODUCTION CHECKS PASSED SUCCESSFULLY!${c.reset}`);
    console.log(`${c.green}Your Amanah Capital system is fully primed for cPanel / Phusion Passenger.${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${c.bold}${c.red}❌ ${failedChecks} CRITICAL CHECK(S) FAILED.${c.reset}`);
    console.log(`${c.red}Please address the remediation steps marked above before launching.${c.reset}\n`);
    process.exit(1);
  }
}

runProductionTests().catch((fatalErr) => {
  console.error(`\n${c.red}[FATAL RUNNER ERROR]:${c.reset}`, fatalErr);
  process.exit(1);
});
