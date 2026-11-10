/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 011_audit_logs.sql
| Description : System Audit Logs
| Author      : Development Team
| Version     : 1.0
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS audit_logs
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NULL,

    module_name VARCHAR(100) NOT NULL,

    entity_name VARCHAR(100) NOT NULL,

    entity_id BIGINT UNSIGNED NULL,

    action ENUM
    (
        'LOGIN',
        'LOGOUT',
        'CREATE',
        'UPDATE',
        'DELETE',
        'VIEW',
        'APPROVE',
        'REJECT',
        'PAYMENT',
        'EXPORT',
        'IMPORT',
        'BACKUP',
        'RESTORE',
        'DISBURSE',
        'SETTINGS_UPDATE'
    ) NOT NULL,

    old_values JSON NULL,

    new_values JSON NULL,

    description VARCHAR(500) NULL,

    ip_address VARCHAR(45) NULL,

    user_agent VARCHAR(500) NULL,

    request_method ENUM
    (
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
    ) NULL,

    request_url VARCHAR(255) NULL,

    session_id VARCHAR(255) NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT fk_audit_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
