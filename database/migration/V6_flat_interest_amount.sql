-- Migration V6: Replace percentage-based loan interest with flat interest amount
-- Amanah Capital - Microfinance Loan Management System

-- 1. loan_applications
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS approved_principal DECIMAL(15,2) NULL AFTER requested_amount,
ADD COLUMN IF NOT EXISTS approved_interest_amount DECIMAL(15,2) NULL AFTER approved_principal,
ADD COLUMN IF NOT EXISTS approved_total_payable DECIMAL(15,2) NULL AFTER approved_interest_amount,
ADD COLUMN IF NOT EXISTS interest_calculation_method ENUM('PERCENTAGE', 'FLAT_AMOUNT') NOT NULL DEFAULT 'FLAT_AMOUNT' AFTER approved_total_payable;

-- 2. loans
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS flat_interest_amount DECIMAL(15,2) NULL DEFAULT 0.00 AFTER principal_amount,
ADD COLUMN IF NOT EXISTS interest_calculation_method ENUM('PERCENTAGE', 'FLAT_AMOUNT') NOT NULL DEFAULT 'FLAT_AMOUNT' AFTER maturity_date;

-- 3. loan_schemes
ALTER TABLE loan_schemes
ADD COLUMN IF NOT EXISTS base_interest_amount DECIMAL(15,2) NULL DEFAULT 0.00 AFTER base_interest_rate;

-- 4. loan_scheme_snapshots
ALTER TABLE loan_scheme_snapshots
ADD COLUMN IF NOT EXISTS interest_amount DECIMAL(15,2) NULL DEFAULT 0.00 AFTER interest_rate,
ADD COLUMN IF NOT EXISTS interest_calculation_method ENUM('PERCENTAGE', 'FLAT_AMOUNT') NOT NULL DEFAULT 'FLAT_AMOUNT' AFTER interest_amount;
