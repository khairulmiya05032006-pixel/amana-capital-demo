/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 008_payments.sql
| Description : Customer Loan Payments
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS payments
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    payment_number VARCHAR(30) NOT NULL,

    loan_id BIGINT UNSIGNED NOT NULL,

    installment_id BIGINT UNSIGNED NOT NULL,

    customer_id BIGINT UNSIGNED NOT NULL,

    collected_by BIGINT UNSIGNED NOT NULL,

    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    payment_amount DECIMAL(15,2) NOT NULL,

    principal_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    interest_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    penalty_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    payment_method ENUM
    (
        'CASH',
        'UPI',
        'BANK_TRANSFER',
        'CHEQUE'
    ) NOT NULL,

    transaction_reference VARCHAR(100) NULL,

    receipt_number VARCHAR(30) NULL,

    payment_status ENUM
    (
        'SUCCESS',
        'PENDING',
        'FAILED',
        'REVERSED'
    )
    NOT NULL DEFAULT 'SUCCESS',

    remarks VARCHAR(500) NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_payment_number
        UNIQUE(payment_number),

    CONSTRAINT uk_receipt_number
        UNIQUE(receipt_number),

    CONSTRAINT fk_payment_loan
        FOREIGN KEY(loan_id)
        REFERENCES loans(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_payment_installment
        FOREIGN KEY(installment_id)
        REFERENCES loan_installments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_payment_customer
        FOREIGN KEY(customer_id)
        REFERENCES customer_profiles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_payment_collector
        FOREIGN KEY(collected_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_amount
        CHECK(payment_amount > 0),

    CONSTRAINT chk_principal_paid
        CHECK(principal_paid >= 0),

    CONSTRAINT chk_interest_paid
        CHECK(interest_paid >= 0),

    CONSTRAINT chk_penalty_paid
        CHECK(penalty_paid >= 0),

    CONSTRAINT chk_payment_breakup
        CHECK(
            payment_amount =
            principal_paid +
            interest_paid +
            penalty_paid
        )
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
