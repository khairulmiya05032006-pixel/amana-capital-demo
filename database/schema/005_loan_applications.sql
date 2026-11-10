/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 005_loan_applications.sql
| Description : Loan Application Table
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



-- ============================================================
-- TABLE : loan_applications
-- Description:
-- Stores customer loan applications before approval.
-- One approved application creates one loan.
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_applications
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    application_number VARCHAR(30) NOT NULL,

    customer_id BIGINT UNSIGNED NOT NULL,

    loan_type_id BIGINT UNSIGNED NOT NULL,

    requested_amount DECIMAL(15,2) NOT NULL,

    requested_interest_rate DECIMAL(5,2) NULL,

    requested_duration_months SMALLINT UNSIGNED NOT NULL,

    purpose TEXT NOT NULL,

    monthly_income DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    existing_loan_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    collateral_details TEXT NULL,

    guarantor_name VARCHAR(120) NULL,

    guarantor_phone VARCHAR(15) NULL,

    application_status ENUM
    (
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    )
    NOT NULL DEFAULT 'PENDING',

    admin_remarks TEXT NULL,

    reviewed_by BIGINT UNSIGNED NULL,

    reviewed_at DATETIME NULL,

    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_application_number
        UNIQUE(application_number),

    CONSTRAINT fk_application_customer
        FOREIGN KEY(customer_id)
        REFERENCES customer_profiles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_loan_type
        FOREIGN KEY(loan_type_id)
        REFERENCES loan_types(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_reviewed_by
        FOREIGN KEY(reviewed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT chk_requested_amount
        CHECK(requested_amount > 0),

    CONSTRAINT chk_requested_duration
        CHECK(requested_duration_months > 0),

    CONSTRAINT chk_monthly_income
        CHECK(monthly_income >= 0)

)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
