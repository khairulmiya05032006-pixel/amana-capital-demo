-- ============================================================================
-- V8: Production Performance & Security Optimization Indexes
-- Amanah Capital Microfinance Management System
-- Purpose: Eliminate table scans on frequently filtered and joined columns
-- Target Latency: DB queries < 50ms, Page loads < 500ms
-- ============================================================================

-- 1. Loans Table Performance Indexes
ALTER TABLE loans 
  ADD INDEX IF NOT EXISTS idx_loans_status (loan_status),
  ADD INDEX IF NOT EXISTS idx_loans_disbursement_date (disbursement_date),
  ADD INDEX IF NOT EXISTS idx_loans_customer_status (customer_id, loan_status);

-- 2. Loan Installments Table Performance Indexes (Hotspot for Daily Jobs & Portfolio Views)
ALTER TABLE loan_installments 
  ADD INDEX IF NOT EXISTS idx_installments_status (installment_status),
  ADD INDEX IF NOT EXISTS idx_installments_due_date (due_date),
  ADD INDEX IF NOT EXISTS idx_installments_status_due (installment_status, due_date),
  ADD INDEX IF NOT EXISTS idx_installments_loan_status (loan_id, installment_status);

-- 3. Payments Table Performance Indexes (Reporting & Ledger Lookups)
ALTER TABLE payments 
  ADD INDEX IF NOT EXISTS idx_payments_date (payment_date),
  ADD INDEX IF NOT EXISTS idx_payments_loan_date (loan_id, payment_date),
  ADD INDEX IF NOT EXISTS idx_payments_method (payment_method);

-- 4. Loan Applications Table Performance Indexes (Pipeline & Approval Filtering)
ALTER TABLE loan_applications 
  ADD INDEX IF NOT EXISTS idx_applications_status (application_status),
  ADD INDEX IF NOT EXISTS idx_applications_created (created_at),
  ADD INDEX IF NOT EXISTS idx_applications_customer_status (customer_id, application_status);

-- 5. Audit Logs Table Performance Indexes (Admin Activity Lookups & Log Exports)
ALTER TABLE audit_logs 
  ADD INDEX IF NOT EXISTS idx_audit_created (created_at),
  ADD INDEX IF NOT EXISTS idx_audit_module_created (module_name, created_at);

-- 6. Customer Profiles Table Performance Indexes
ALTER TABLE customer_profiles 
  ADD INDEX IF NOT EXISTS idx_customer_created (created_at);

-- 7. Penalties Table Performance Indexes (Active/Applied Penalty Lookups)
ALTER TABLE penalties 
  ADD INDEX IF NOT EXISTS idx_penalties_status (status);

-- 8. Loan Transactions Ledger Performance Indexes
ALTER TABLE loan_transactions 
  ADD INDEX IF NOT EXISTS idx_transactions_date (transaction_date),
  ADD INDEX IF NOT EXISTS idx_transactions_type (transaction_type);

-- 9. Admin Account Transactions Performance Indexes
ALTER TABLE admin_account_transactions 
  ADD INDEX IF NOT EXISTS idx_admin_created (created_at),
  ADD INDEX IF NOT EXISTS idx_admin_txn_type (transaction_type);
