/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 004_loan_types.sql
| Description : Loan Type Master Table
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



-- ============================================================
-- TABLE : loan_types
-- Description:
-- Master table for all loan products offered by the organization.
-- This table stores business rules for each loan type.
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_types
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    loan_type_code VARCHAR(20) NOT NULL,

    loan_name VARCHAR(100) NOT NULL,

    description TEXT NULL,

    minimum_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    maximum_amount DECIMAL(15,2) NOT NULL,

    minimum_interest_rate DECIMAL(5,2) NOT NULL,

    maximum_interest_rate DECIMAL(5,2) NOT NULL,

    minimum_duration_months INT UNSIGNED NOT NULL,

    maximum_duration_months INT UNSIGNED NOT NULL,

    processing_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    late_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    penalty_interest_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    display_order INT UNSIGNED NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT uk_loan_type_code
        UNIQUE (loan_type_code),

    CONSTRAINT uk_loan_type_name
        UNIQUE (loan_name),

    CONSTRAINT chk_min_amount
        CHECK (minimum_amount >= 0),

    CONSTRAINT chk_max_amount
        CHECK (maximum_amount >= minimum_amount),

    CONSTRAINT chk_min_interest
        CHECK (minimum_interest_rate >= 0),

    CONSTRAINT chk_max_interest
        CHECK (maximum_interest_rate >= minimum_interest_rate),

    CONSTRAINT chk_min_duration
        CHECK (minimum_duration_months > 0),

    CONSTRAINT chk_max_duration
        CHECK (maximum_duration_months >= minimum_duration_months)

)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;
