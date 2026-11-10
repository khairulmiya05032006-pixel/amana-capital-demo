-- Migration V7: Whole-Rupee EMI Distribution and Upward Rounding
-- Amanah Capital - Microfinance Loan Management System

-- 1. loan_applications: Store separate approved rounding adjustment
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS approved_rounding_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER approved_interest_amount;

-- 2. loans: Store loan-level rounding adjustment
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS rounding_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER flat_interest_amount;

-- 3. loan_installments: Store per-installment rounding adjustment component
ALTER TABLE loan_installments
ADD COLUMN IF NOT EXISTS rounding_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER interest_amount;

-- 4. loan_scheme_snapshots: Store immutable rounding adjustment in snapshot
ALTER TABLE loan_scheme_snapshots
ADD COLUMN IF NOT EXISTS rounding_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER interest_amount;
