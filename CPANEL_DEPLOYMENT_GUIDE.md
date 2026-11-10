# AMANAH CAPITAL — cPanel Production Deployment Guide & Migration Manual

> **System:** Amanah Capital Microfinance Management System  
> **Stack:** Node.js 18+ (ESM), Express.js 5, MySQL 8 / MariaDB 10.4+, EJS / EJS-Mate, Phusion Passenger  
> **Document Version:** 2.0.0 (Production Release)  
> **Last Updated:** November 2026

---

## Table of Contents
1. [Executive Summary & Quick-Start (5-Minute Deployment)](#1-executive-summary--quick-start-5-minute-deployment)
2. [Prerequisites & Hosting Requirements](#2-prerequisites--hosting-requirements)
3. [Step 1: Database Provisioning in cPanel](#3-step-1-database-provisioning-in-cpanel)
4. [Step 2: Database Migration (1-Click or CLI)](#4-step-2-database-migration-1-click-or-cli)
5. [Step 3: Deploying Code to cPanel (Git vs File Manager)](#5-step-3-deploying-code-to-cpanel-git-vs-file-manager)
6. [Step 4: Configuring "Setup Node.js App" in cPanel](#6-step-4-configuring-setup-nodejs-app-in-cpanel)
7. [Step 5: Production Environment Variables (`.env`)](#7-step-5-production-environment-variables-env)
8. [Step 6: Configuring Automated Cron Jobs](#8-step-6-configuring-automated-cron-jobs)
9. [Step 7: Verification & Health Checks](#9-step-7-verification--health-checks)
10. [Step 8: Troubleshooting & Operational Runbook](#10-step-8-troubleshooting--operational-runbook)

---

## 1. Executive Summary & Quick-Start (5-Minute Deployment)

Amanah Capital is engineered for modern microfinance operations, supporting **direct flat-interest loan calculation**, **front-loaded whole-rupee EMI distribution** (no decimal paise in customer installments), and **automated frequency-based penalty policies** (fixed amount or percentage).

### 5-Step Deployment Fast Track:
```
┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│ 1. Create cPanel DB    │ ──> │ 2. Run Fresh Migration │ ──> │ 3. Setup Node.js App   │
│    (Database Wizard)   │     │    (phpMyAdmin Import) │     │    (server.js / v20+)  │
└────────────────────────┘     └────────────────────────┘     └────────────────────────┘
                                                                           │
                               ┌────────────────────────┐                  │
                               │ 5. Verify & Restart    │ <────────────────┘
                               │    (GET /health)       │
                               └────────────────────────┘
```

1. **Create Database:** In cPanel → **MySQL Database Wizard**, create database & user, grant **ALL PRIVILEGES**.
2. **Import Migration:** In **phpMyAdmin**, select the database and import `database/cpanel_fresh_migration.sql`.
3. **Upload Code:** Clone via cPanel **Git Version Control** or upload a `.zip` file via **File Manager**.
4. **Configure Node.js:** In cPanel → **Setup Node.js App**, create an app targeting `server.js` (Node 18 or 20+).
5. **Set `.env` & Restart:** Fill your `.env` credentials, click **Run NPM Install**, and restart the app.

---

## 2. Prerequisites & Hosting Requirements

Ensure your hosting environment meets the following specifications:

| Requirement | Minimum Version | Recommended | Notes |
|:---|:---|:---|:---|
| **Node.js** | `v18.16.0+` | `v20.x` or `v22.x LTS` | Requires ESM support (`"type": "module"` in `package.json`) |
| **Database** | MySQL `8.0+` / MariaDB `10.4+` | MySQL `8.0.35+` | Supports strict mode & JSON column types |
| **cPanel Feature** | CloudLinux "Setup Node.js App" | With Phusion Passenger | Standard on 95% of modern cPanel hosts |
| **RAM** | 512 MB minimum | 1 GB - 2 GB | Baseline app memory is ~80MB - 120MB RSS |
| **Disk Space** | 500 MB | 2 GB+ | Includes dependencies, uploads, and log storage |
| **SSL Certificate** | Required for HTTPS | Let's Encrypt / AutoSSL | Included free with all cPanel hosts |

---

## 3. Step 1: Database Provisioning in cPanel

cPanel prefixes all database and username entities with your cPanel account username (e.g., `cpuser_`).

1. Log in to your **cPanel Dashboard**.
2. Navigate to **Databases** → **MySQL® Database Wizard**.
3. **Step 1: Create A Database**
   - Enter database name suffix: `amanah_db`
   - Complete Name: `cpuser_amanah_db`
   - Click **Next Step**.
4. **Step 2: Create Database Users**
   - Username suffix: `amanah_usr`
   - Complete Username: `cpuser_amanah_usr`
   - Password: Use the **Password Generator** to create a strong 16+ character password (e.g., `N@9#kP2$vL91!zQx`).
   - *Save this password securely for your `.env` file.*
   - Click **Create User**.
5. **Step 3: Add User to Database**
   - Check the box: **ALL PRIVILEGES**.
   - Click **Make Changes**.

---

## 4. Step 2: Database Migration (1-Click or CLI)

We have provided a consolidated, turnkey migration script:
`database/cpanel_fresh_migration.sql`

This file:
- Automatically disables foreign key checks to avoid dependency import issues.
- Creates all **19 production tables** with optimal `utf8mb4_unicode_ci` collations.
- Applies all **20 performance indexes (V8)** for sub-50ms query responses.
- Seeds the initial **Super Admin**, default active **loan types**, standard **loan schemes** (Monthly, Weekly, Daily), **penalty settings**, and admin working capital balance (₹100,000.00).
- Is **100% DEFINER-free**, preventing remote hosting MySQL permission errors.

### Option A: 1-Click Import via phpMyAdmin (Easiest)
1. In cPanel, click **phpMyAdmin** under the **Databases** group.
2. In the left sidebar, click on your newly created database (`cpuser_amanah_db`).
3. Click the **Import** tab on the top navigation bar.
4. Click **Choose File** and select `database/cpanel_fresh_migration.sql` from your local machine or repository.
5. Ensure Format is set to **SQL**.
6. Scroll down and click **Import** (or **Go**).
7. You will see a green success message: *Import has been successfully finished, queries executed.*

### Option B: Command Line via cPanel Terminal
If your hosting plan provides cPanel **Terminal** access:
```bash
# Navigate to application root
cd ~/amanah-capital

# Run the automated turnkey migration tool
npm run migrate
```
*The migration runner connects using your `.env` credentials, creates all tables, verifies views and seed records, and prints the default credentials.*

### Default Super Admin Credentials Seeded:
- **Login URL:** `https://yourdomain.com/admin/login`
- **Email:** `admin@microfinance.com`
- **Password:** `Admin@123`
*(Make sure to change this password immediately after your first login under Admin Settings).*

---

## 5. Step 3: Deploying Code to cPanel (Git vs File Manager)

### Method 1: Git Version Control (Recommended for Ongoing Updates)
1. In cPanel, navigate to **Files** → **Git™ Version Control**.
2. Click **Create**.
3. Configure the repository:
   - **Clone URL:** `https://github.com/your-username/amanah-capital.git` (or your private Git repository URL).
   - **Repository Path:** `repositories/amanah-capital`
   - **Repository Name:** `amanah-capital`
4. Click **Create**.
5. The repository includes an automated `.cpanel.yml` deployment script that automatically creates runtime directories (`tmp`, `logs`, `storage`, `public/uploads`) and touches `tmp/restart.txt`.
6. Whenever you push changes to GitHub, simply click **Update from Remote** and **Deploy HEAD Commit** in cPanel.

### Method 2: Manual Zip Upload via File Manager
1. On your local machine, create a deployment archive excluding development/scratch files:
   - **DO NOT** include `node_modules` (will be installed natively on the server).
   - **DO NOT** include local `.env` (will be configured on cPanel).
   - **DO NOT** include `.git`.
2. In cPanel, open **File Manager**.
3. Create an application directory outside public web root for security:  
   `/home/cpuser/amanah-capital`
4. Upload your zip file and click **Extract**.
5. Verify that `server.js`, `app.js`, `package.json`, and `public/` are in the folder.

---

## 6. Step 4: Configuring "Setup Node.js App" in cPanel

cPanel uses **CloudLinux LVE** with **Phusion Passenger** to manage Node.js processes.

1. In cPanel, search for and click **Setup Node.js App** (under **Software**).
2. Click **Create Application**.
3. Fill in the application parameters:
   - **Node.js version:** Select `20.x` (or `18.x`).
   - **Application mode:** `production`
   - **Application root:** `amanah-capital` (relative to `/home/cpuser/`).
   - **Application URL:** Select your domain or subdomain (e.g., `app.yourdomain.com` or `yourdomain.com`).
   - **Application startup file:** `server.js`
4. Click **Create**.
5. The page will refresh and display the **Node.js virtual environment command** at the top (e.g., `source /home/cpuser/nodevenv/amanah-capital/20/bin/activate`).
6. Scroll down to the **Detected configuration files** section.
7. Click the **Run NPM Install** button.
   *(This downloads and builds all required dependencies natively for CloudLinux).*

---

## 7. Step 5: Production Environment Variables (`.env`)

In cPanel **File Manager**, navigate to your application root (`/home/cpuser/amanah-capital`), create a new file named `.env`, and populate it with your production settings:

```dotenv
# ==============================================================================
# AMANAH CAPITAL - PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# Application Runtime
NODE_ENV=production
PORT=8080

# Database Configuration (MySQL 8 / MariaDB)
DB_HOST=localhost
DB_PORT=3306
DB_USER=cpuser_amanah_usr
DB_PASSWORD=YourStrongPasswordHere_123!
DB_NAME=cpuser_amanah_db
DB_CONNECTION_LIMIT=20
DB_USE_SSL=false

# Security & Authentication Secrets
# Generate strong 64-character random hex keys for production
JWT_SECRET=8f4a7c29e1d3b5e8f0a2c4e6819a3b5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b
SESSION_SECRET=3d5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e7f9a1b3c5e

# Rate Limiting & Protection
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=50

# Application Identity & Localization
COMPANY_NAME="Amanah Capital Microfinance"
CURRENCY_SYMBOL="₹"
TIMEZONE="Asia/Kolkata"
```

> [!IMPORTANT]
> - Ensure `NODE_ENV=production` is set so that EJS template caching, Gzip compression, and secure HTTP-only cookies are enabled.
> - `JWT_SECRET` and `SESSION_SECRET` must be kept secret. Do not use default or placeholder values in production.

---

## 8. Step 6: Configuring Automated Cron Jobs

In microfinance systems, overdue penalty calculation and loan aging must execute daily. On cPanel shared hosting, MySQL Events (`CREATE EVENT`) are often disabled for non-root users. Therefore, Amanah Capital includes a dedicated Node.js cron runner: `scripts/maintenance/run_penalty_job.js`.

### 1. Penalty Calculation Cron Job (Daily at 00:05 AM)
1. In cPanel, navigate to **Advanced** → **Cron Jobs**.
2. Under **Add New Cron Job**:
   - Common Settings: **Once Per Day (0 0 * * *)**
   - Minute: `5`
   - Hour: `0`
   - Day: `*`
   - Month: `*`
   - Weekday: `*`
3. Enter Command (replace `/home/cpuser/` with your actual cPanel home directory):
   ```bash
   /usr/local/bin/node /home/cpuser/amanah-capital/scripts/maintenance/run_penalty_job.js >> /home/cpuser/amanah-capital/logs/cron_penalty.log 2>&1
   ```
4. Click **Add New Cron Job**.

### 2. Daily Database Backup Cron Job (Daily at 02:00 AM)
1. Under **Add New Cron Job**:
   - Minute: `0`
   - Hour: `2`
   - Day: `*`
   - Month: `*`
   - Weekday: `*`
2. Enter Command:
   ```bash
   mysqldump -u cpuser_amanah_usr -p'YourStrongPasswordHere_123!' cpuser_amanah_db | gzip > /home/cpuser/amanah-capital/database/backups/backup_$(date +\%Y\%m\%d).sql.gz
   ```
3. Click **Add New Cron Job**.

---

## 9. Step 7: Verification & Health Checks

Once deployed, perform the following verification and smoke tests:

### 1. Automated cPanel Production Test Suite (Recommended)
Run the automated test runner in cPanel Terminal:
```bash
npm test
# OR: npm run test:cpanel
```
This tests:
- Node 20/22 runtime and production `.env` settings.
- Writable directories (`tmp/`, `logs/`, `storage/`, `public/uploads/`) and Phusion Passenger reload mechanism.
- Database ping latency and pool configuration.
- Presence of all 19 base tables, V8 performance indexes, and flat-interest whole-rupee columns.
- Seed data presence (Super Admin, schemes, penalty settings, liquidity).
- Express HTTP listener, `GET /health`, security headers (Helmet), and static asset caching.

---

### 2. Production Health Check Endpoint
Open your browser and navigate to:
`https://yourdomain.com/health`

You should receive a `200 OK` JSON response:
```json
{
  "status": "UP",
  "timestamp": "2026-11-08T01:15:00.000Z",
  "uptime": "12m",
  "dbLatency": "18ms",
  "memory": {
    "rss": "95MB",
    "heapUsed": "32MB"
  }
}
```
- **Database Latency:** Target is `< 50ms`.
- **Status:** Must be `"UP"`.

### 2. Super Admin Login
1. Navigate to: `https://yourdomain.com/admin/login`
2. Login with `admin@microfinance.com` / `Admin@123`.
3. Verify the Admin Dashboard renders with liquidity balances and loan stats.

### 3. Verify Whole-Rupee EMI Schedule Preview
1. In Admin Dashboard, navigate to an existing loan application or create a new one.
2. Click **Review Application**.
3. Enter Approved Principal (e.g. ₹5,000) and Flat Interest (e.g. ₹500).
4. Verify the **Live Loan Calculation & Schedule Preview**:
   - Shows Total Payable (₹5,500).
   - Higher EMI installments appear first (e.g. 100 × ₹46).
   - Lower EMI installments appear last (e.g. 20 × ₹45).
   - **Zero decimals** in EMI amounts.

### 4. Verify Penalty Engine Settings
1. Navigate to **Admin Settings** → **Penalty & Late Fee Settings**.
2. Verify you can toggle between **Percentage (%)** and **Fixed Amount (₹)**.
3. Save changes and verify version increments without errors.

---

## 10. Step 8: Troubleshooting & Operational Runbook

### Issue A: How to Restart the Node.js App After Changes?
Phusion Passenger watches for timestamp changes on `tmp/restart.txt`.
To restart the app, do either of the following:
1. In cPanel **Setup Node.js App**, click the **Restart** button.
2. OR via cPanel Terminal / SSH:
   ```bash
   touch /home/cpuser/amanah-capital/tmp/restart.txt
   ```

### Issue B: 503 Service Unavailable / Application Did Not Start
1. Check passenger error logs located in your home directory or app root:
   - Look at `stderr.log` in `/home/cpuser/amanah-capital/`.
   - In cPanel Terminal, test starting standalone to catch runtime errors:
     ```bash
     cd ~/amanah-capital
     node server.js
     ```
2. Verify startup validation:
   - If `JWT_SECRET` is unset or `DB_PASSWORD` is missing, `server.js` exits immediately with an error log explaining the missing variable.

### Issue C: EACCES / Directory Permission Errors on File Uploads
Ensure runtime directories are writable by the web server process:
```bash
chmod 755 /home/cpuser/amanah-capital/public/uploads
chmod 755 /home/cpuser/amanah-capital/storage
chmod 755 /home/cpuser/amanah-capital/logs
chmod 755 /home/cpuser/amanah-capital/tmp
```

### Issue D: Database "Access Denied" or Connection Pool Timeouts
1. Double-check that your `.env` contains the exact full cPanel prefix:
   - `DB_USER=cpuser_amanah_usr` (not just `amanah_usr`).
   - `DB_NAME=cpuser_amanah_db` (not just `amanah_db`).
2. Verify in **MySQL® Databases** that `cpuser_amanah_usr` has **ALL PRIVILEGES** assigned to `cpuser_amanah_db`.
3. If hosting MySQL on a separate database server, change `DB_HOST=localhost` to your remote DB IP or hostname.

---

## Deployment Sign-Off Checklist

- [x] Database created and user assigned with `ALL PRIVILEGES`.
- [x] `database/cpanel_fresh_migration.sql` executed (19 tables, 4 views, seed data).
- [x] Application configured in cPanel "Setup Node.js App" with Node 18+ and `server.js`.
- [x] Dependencies installed cleanly (`npm install`).
- [x] `.env` created with production secrets and database credentials.
- [x] Permissions set for `tmp/`, `logs/`, `storage/`, and `public/uploads/`.
- [x] Scheduled cron job added for daily penalty calculations (`scripts/maintenance/run_penalty_job.js`).
- [x] Health check verified at `/health` (`status: UP`, DB latency `< 50ms`).
- [x] Admin logged in and changed default password.
