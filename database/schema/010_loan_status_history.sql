/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 010_application_status_history.sql
| Description : Loan Application Status History
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS application_status_history
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    application_id BIGINT UNSIGNED NOT NULL,

    previous_status ENUM
    (
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    ) NULL,

    new_status ENUM
    (
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    ) NOT NULL,

    changed_by BIGINT UNSIGNED NOT NULL,

    changed_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    reason VARCHAR(500) NULL,

    remarks TEXT NULL,

    ip_address VARCHAR(45) NULL,

    device_info VARCHAR(255) NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT fk_application_status_history_application
        FOREIGN KEY(application_id)
        REFERENCES loan_applications(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_application_status_history_user
        FOREIGN KEY(changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
