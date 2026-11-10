/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 009_loan_transactions.sql
| Description : Financial Ledger for Loan Transactions
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS loan_transactions
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    transaction_number VARCHAR(30) NOT NULL,

    loan_id BIGINT UNSIGNED NOT NULL,

    installment_id BIGINT UNSIGNED NULL,

    payment_id BIGINT UNSIGNED NULL,

    customer_id BIGINT UNSIGNED NOT NULL,

    transaction_type ENUM
    (
        'DISBURSEMENT',
        'PAYMENT',
        'PENALTY',
        'INTEREST',
        'WAIVER',
        'REFUND',
        'ADJUSTMENT',
        'WRITE_OFF'
    ) NOT NULL,

    debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    running_balance DECIMAL(15,2) NOT NULL,

    transaction_date DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    reference_number VARCHAR(100) NULL,

    description VARCHAR(500) NULL,

    created_by BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_transaction_number
        UNIQUE(transaction_number),

    CONSTRAINT fk_transaction_loan
        FOREIGN KEY(loan_id)
        REFERENCES loans(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_transaction_installment
        FOREIGN KEY(installment_id)
        REFERENCES loan_installments(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_transaction_payment
        FOREIGN KEY(payment_id)
        REFERENCES payments(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_transaction_customer
        FOREIGN KEY(customer_id)
        REFERENCES customer_profiles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_transaction_created_by
        FOREIGN KEY(created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_debit_amount
        CHECK(debit_amount >= 0),

    CONSTRAINT chk_credit_amount
        CHECK(credit_amount >= 0),

    CONSTRAINT chk_running_balance
        CHECK(running_balance >= 0)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
