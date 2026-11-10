/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 007_loan_installments.sql
| Description : Loan Installment Schedule
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS loan_installments
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    loan_id BIGINT UNSIGNED NOT NULL,

    installment_number SMALLINT UNSIGNED NOT NULL,

    due_date DATE NOT NULL,

    opening_balance DECIMAL(15,2) NOT NULL,

    principal_amount DECIMAL(15,2) NOT NULL,

    interest_amount DECIMAL(15,2) NOT NULL,

    penalty_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    total_amount DECIMAL(15,2) NOT NULL,

    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    remaining_amount DECIMAL(15,2) NOT NULL,

    closing_balance DECIMAL(15,2) NOT NULL,

    installment_status ENUM
    (
        'PENDING',
        'PARTIALLY_PAID',
        'PAID',
        'OVERDUE',
        'WAIVED'
    )
    NOT NULL DEFAULT 'PENDING',

    paid_date DATE NULL,

    remarks VARCHAR(500) NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_loan_installment
        UNIQUE
        (
            loan_id,
            installment_number
        ),

    CONSTRAINT fk_installment_loan
        FOREIGN KEY(loan_id)
        REFERENCES loans(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_installment_principal
        CHECK(principal_amount >= 0),

    CONSTRAINT chk_installment_interest
        CHECK(interest_amount >= 0),

    CONSTRAINT chk_installment_penalty
        CHECK(penalty_amount >= 0),

    CONSTRAINT chk_installment_paid
        CHECK(paid_amount >= 0),

    CONSTRAINT chk_installment_remaining
        CHECK(remaining_amount >= 0)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
