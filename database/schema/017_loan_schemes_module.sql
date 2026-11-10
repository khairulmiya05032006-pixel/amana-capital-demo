

-- 1. loan_schemes (Owned by Admin Service)
CREATE TABLE IF NOT EXISTS loan_schemes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scheme_code VARCHAR(30) NOT NULL UNIQUE,
    scheme_name VARCHAR(100) NOT NULL,
    description TEXT,
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
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. customer_scheme_subscriptions (Owned by Loan Service)
CREATE TABLE IF NOT EXISTS customer_scheme_subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    loan_id BIGINT UNSIGNED NOT NULL UNIQUE,
    scheme_id BIGINT UNSIGNED NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    override_reason VARCHAR(255) NULL,
    PRIMARY KEY(id),
    CONSTRAINT fk_css_loan FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_css_scheme FOREIGN KEY(scheme_id) REFERENCES loan_schemes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_css_customer FOREIGN KEY(customer_id) REFERENCES customer_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. payment_schedules (Unified Table for New Scheme Loans, Owned by Loan Service)
CREATE TABLE IF NOT EXISTS payment_schedules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id BIGINT UNSIGNED NOT NULL,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    penalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_due DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) NOT NULL,
    status ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_ps_loan FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uk_loan_installment (loan_id, installment_number),
    INDEX idx_due_date_status (due_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. penalties (Owned by Loan Service)
CREATE TABLE IF NOT EXISTS penalties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id BIGINT UNSIGNED NOT NULL,
    schedule_id BIGINT UNSIGNED NOT NULL,
    penalty_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED') NOT NULL DEFAULT 'UNPAID',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_penalties_loan FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_penalties_schedule FOREIGN KEY(schedule_id) REFERENCES payment_schedules(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uk_penalty_schedule (schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Backfill Strategy (Legacy Placeholder)
INSERT INTO loan_schemes (
    scheme_code, scheme_name, interest_type, base_interest_rate, 
    repayment_frequency, duration_value, duration_unit, is_active
)
SELECT 'LEGACY_MONTHLY', 'Legacy Monthly Product', 'REDUCING_BALANCE', 12.00, 'MONTHLY', 12, 'MONTHS', FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM loan_schemes WHERE scheme_code = 'LEGACY_MONTHLY');

-- Get the ID safely
SET @legacy_scheme_id = (SELECT id FROM loan_schemes WHERE scheme_code = 'LEGACY_MONTHLY' LIMIT 1);

INSERT IGNORE INTO customer_scheme_subscriptions (customer_id, loan_id, scheme_id, override_reason)
SELECT customer_id, id, @legacy_scheme_id, 'Legacy Data Backfill' 
FROM loans;