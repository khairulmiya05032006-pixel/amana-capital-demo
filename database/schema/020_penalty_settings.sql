

CREATE TABLE IF NOT EXISTS penalty_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    repayment_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    calculation_method ENUM('PERCENTAGE_OF_OVERDUE', 'FIXED_AMOUNT') NOT NULL DEFAULT 'PERCENTAGE_OF_OVERDUE',
    penalty_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    fixed_penalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    grace_period_days INT UNSIGNED NOT NULL DEFAULT 0,
    maximum_penalty_cap DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    auto_apply BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT UNSIGNED NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_penalty_frequency (repayment_frequency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO penalty_settings (repayment_frequency, penalty_rate, grace_period_days, maximum_penalty_cap) VALUES 
('DAILY', 2.00, 0, 15.00),
('WEEKLY', 2.50, 1, 15.00),
('MONTHLY', 3.00, 7, 15.00);
