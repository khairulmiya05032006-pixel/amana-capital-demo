/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 016_direct_loans_support.sql
| Description : Updates schema to support Direct Admin Loans
|--------------------------------------------------------------------------
*/



-- 1. Modify `loans` table constraints and columns
ALTER TABLE loans 
MODIFY COLUMN application_id BIGINT UNSIGNED NULL;

ALTER TABLE loans 
ADD COLUMN loan_source ENUM('CUSTOMER_APPLICATION', 'DIRECT_ADMIN') NOT NULL DEFAULT 'CUSTOMER_APPLICATION' AFTER loan_number;

ALTER TABLE loans 
ADD COLUMN created_by_admin_id BIGINT UNSIGNED NULL AFTER loan_source;

ALTER TABLE loans 
ADD COLUMN approval_type ENUM('MANUAL', 'AUTOMATIC', 'DIRECT_ADMIN') NOT NULL DEFAULT 'MANUAL' AFTER created_by_admin_id;

ALTER TABLE loans
ADD CONSTRAINT fk_loan_creator 
FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 2. Modify `loan_transactions`
ALTER TABLE loan_transactions 
ADD COLUMN disbursement_type ENUM('NORMAL', 'DIRECT', 'RESTRUCTURE', 'TOPUP') NULL AFTER transaction_type;

