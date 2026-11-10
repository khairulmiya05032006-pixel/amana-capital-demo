/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 006_loans.sql
| Description : Approved Loans
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS loans
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    loan_number VARCHAR(30) NOT NULL,

    application_id BIGINT UNSIGNED NOT NULL,

    customer_id BIGINT UNSIGNED NOT NULL,

    loan_type_id BIGINT UNSIGNED NOT NULL,

    approved_by BIGINT UNSIGNED NOT NULL,

    principal_amount DECIMAL(15,2) NOT NULL,

    annual_interest_rate DECIMAL(5,2) NOT NULL,

    tenure_months SMALLINT UNSIGNED NOT NULL,

    emi_amount DECIMAL(15,2) NOT NULL,

    total_interest DECIMAL(15,2) NOT NULL,

    total_payable DECIMAL(15,2) NOT NULL,

    outstanding_balance DECIMAL(15,2) NOT NULL,

    disbursement_date DATE NOT NULL,

    first_installment_date DATE NOT NULL,

    maturity_date DATE NOT NULL,

    repayment_frequency ENUM
    (
        'DAILY',
        'WEEKLY',
        'MONTHLY'
    )
    NOT NULL DEFAULT 'MONTHLY',

    loan_status ENUM
    (
        'ACTIVE',
        'COMPLETED',
        'DEFAULTED',
        'WRITTEN_OFF',
        'CLOSED'
    )
    NOT NULL DEFAULT 'ACTIVE',

    closed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_loan_number
        UNIQUE(loan_number),

    CONSTRAINT fk_loan_application
        FOREIGN KEY(application_id)
        REFERENCES loan_applications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_loan_customer
        FOREIGN KEY(customer_id)
        REFERENCES customer_profiles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_loan_type
        FOREIGN KEY(loan_type_id)
        REFERENCES loan_types(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_loan_admin
        FOREIGN KEY(approved_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_principal
        CHECK(principal_amount > 0),

    CONSTRAINT chk_interest
        CHECK(annual_interest_rate >= 0),

    CONSTRAINT chk_tenure
        CHECK(tenure_months > 0),

    CONSTRAINT chk_emi
        CHECK(emi_amount > 0),

    CONSTRAINT chk_payable
        CHECK(total_payable >= principal_amount)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
