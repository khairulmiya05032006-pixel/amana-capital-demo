# Amanah Capital - Operational Runbook

## 1. System Overview
Amanah Capital Microfinance System is a Node.js/Express monolith backed by a MySQL 8 database. It operates as a FinTech platform managing loans, customers, administrators, and financial ledgers.

## 2. Infrastructure & Deployment
- **Platform**: Node.js v20+, PM2, NGINX
- **Database**: MySQL 8.0+ (Requires SSL in production)
- **Deployment Strategy**: cPanel CloudLinux (Phusion Passenger) or PM2 ecosystem
- **Logs**: Managed by Winston, rotated daily into `logs/` directory. Error and Access logs are separated.

## 3. Operational Procedures

### 3.1 Start / Stop Application
**Using PM2 (Preferred)**:
```bash
pm2 start ecosystem.config.cjs
pm2 stop ecosystem.config.cjs
pm2 restart ecosystem.config.cjs
pm2 reload ecosystem.config.cjs # Zero-downtime reload
```

### 3.2 Checking Application Health
- **Readiness/Health Check**: `GET /api/ready` or `GET /api/health`
- **Liveness Check**: `GET /api/live`
- **PM2 Dashboard**: `pm2 monit`

### 3.3 Log Management
Logs are stored in the root `logs/` directory:
- `application-%DATE%.log`: General application activity.
- `error-%DATE%.log`: Errors, exceptions, and stack traces.
- `access-%DATE%.log`: HTTP request details.

## 4. Backup & Restore

### 4.1 Automated Database Backup
A PowerShell script is provided to safely dump the database configuration and records.
```powershell
.\backup.ps1
```
*Note*: This requires `.env` to be populated with `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME`. Backups are stored in `database/backups/`.

### 4.2 Restoring from Backup
**CRITICAL: Restoring will overwrite existing data.**
```powershell
.\restore.ps1 -BackupFile .\database\backups\backup_YYYYMMDD_HHMMSS.sql
```

## 5. Troubleshooting & Common Issues

**Issue: Webhook errors or Signature Mismatches**
- **Symptom**: Customer payments are not reflecting in the application.
- **Resolution**: Verify that the `WEBHOOK_SECRET` environment variable in the application matches the secret configured in the payment gateway.

**Issue: NGINX 502 Bad Gateway**
- **Symptom**: The site is unreachable.
- **Resolution**: PM2 might be down. Run `pm2 status` and ensure `gateway-app` and all microservices are `online`. Check `logs/error-*.log` for crashes.

**Issue: CSRF Token Missing/Invalid**
- **Symptom**: Form submissions return 403 Forbidden.
- **Resolution**: Ensure the EJS templates have `<input type="hidden" name="_csrf" value="<%= csrfToken %>">` included inside the `<form>` tag.

**Issue: "Check constraint 'chk_payable' is violated"**
- **Symptom**: Database rejects loan approval.
- **Resolution**: The approval form requires interest and fees to be > 0. Ensure frontend validation is working and input sanitization hasn't stripped valid decimals.

## 6. Emergency Contacts
- DevOps Team: [Insert Contact]
- DBA Team: [Insert Contact]
- Lead Engineer: [Insert Contact]
