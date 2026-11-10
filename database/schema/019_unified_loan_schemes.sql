

-- 1. Drop old implementation (Rollback)
DROP EVENT IF EXISTS ev_mark_overdue_v2;
DROP PROCEDURE IF EXISTS sp_record_payment_v2;
DROP PROCEDURE IF EXISTS sp_close_loan_v2;
DROP PROCEDURE IF EXISTS sp_generate_payment_schedule;

DROP TABLE IF EXISTS penalties;
DROP TABLE IF EXISTS payment_schedules;
DROP TABLE IF EXISTS customer_scheme_subscriptions;
DROP TABLE IF EXISTS loan_schemes;

-- 2. Create New Versioned loan_schemes
CREATE TABLE IF NOT EXISTS loan_schemes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_code VARCHAR(30) NOT NULL,
    scheme_name VARCHAR(100) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    parent_scheme_id BIGINT UNSIGNED NULL,
    status ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    interest_type ENUM('FLAT', 'REDUCING_BALANCE') NOT NULL,
    base_interest_rate DECIMAL(7,4) NOT NULL,
    repayment_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    duration_value INT NOT NULL,
    duration_unit ENUM('DAYS', 'WEEKS', 'MONTHS') NOT NULL,
    grace_period_days INT NOT NULL DEFAULT 0,
    penalty_type ENUM('FIXED', 'PERCENTAGE', 'NONE') NOT NULL DEFAULT 'NONE',
    penalty_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    processing_fee_type ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'PERCENTAGE',
    processing_fee_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_scheme_parent FOREIGN KEY(parent_scheme_id) REFERENCES loan_schemes(id) ON DELETE SET NULL,
    CONSTRAINT fk_scheme_created_by FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_scheme_code_version (scheme_code, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Immutable Snapshots
CREATE TABLE IF NOT EXISTS loan_scheme_snapshots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id BIGINT UNSIGNED NOT NULL UNIQUE,
    scheme_id BIGINT UNSIGNED NOT NULL,
    scheme_code VARCHAR(30) NOT NULL,
    scheme_name VARCHAR(100) NOT NULL,
    scheme_version INT NOT NULL,
    interest_type ENUM('FLAT', 'REDUCING_BALANCE') NOT NULL,
    interest_rate DECIMAL(7,4) NOT NULL,
    repayment_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    duration_value INT NOT NULL,
    duration_unit ENUM('DAYS', 'WEEKS', 'MONTHS') NOT NULL,
    grace_period_days INT NOT NULL DEFAULT 0,
    penalty_type ENUM('FIXED', 'PERCENTAGE', 'NONE') NOT NULL DEFAULT 'NONE',
    penalty_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    processing_fee_type ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'PERCENTAGE',
    processing_fee_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_snapshot_loan FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    CONSTRAINT fk_snapshot_scheme FOREIGN KEY(scheme_id) REFERENCES loan_schemes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Evolve loan_installments
ALTER TABLE loan_installments 
ADD COLUMN payment_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') NULL AFTER installment_number,
ADD COLUMN schedule_version VARCHAR(50) NULL AFTER updated_at;

-- Set default frequency for existing legacy loans
UPDATE loan_installments SET payment_frequency = 'MONTHLY' WHERE payment_frequency IS NULL;