$ErrorActionPreference = "Stop"

$DB_HOST = "139.59.11.189"
$DB_PORT = "16510"
$DB_USER = "lmzudyob_amanacapital_db"
$DB_PASS = "AmanaCapital2026#45"
$DB_NAME = "lmzudyob_micofinance_fintech_db"

$files = @(
  "database/schema/002_users.sql",
  "database/schema/003_customer_profiles.sql",
  "database/schema/004_loan_types.sql",
  "database/schema/005_loan_applications.sql",
  "database/schema/006_loans.sql",
  "database/schema/007_loan_installments.sql",
  "database/schema/008_payments.sql",
  "database/schema/009_loan_transactions.sql",
  "database/schema/010_loan_status_history.sql",
  "database/schema/011_audit_logs.sql",
  "database/schema/012_foreign_keys.sql",
  "database/indexes/users_indexes.sql",
  "database/indexes/loans_indexes.sql",
  "database/indexes/payments_indexes.sql",
  "database/procedures/sp_approve_application.sql",
  "database/procedures/sp_generate_emi_schedule.sql",
  "database/seed/admin.sql",
  "database/seed/loan_types.sql"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "Executing $f"
        cmd.exe /c "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < $f"
    } else {
        Write-Host "File not found: $f"
    }
}

Write-Host "Setup complete."
