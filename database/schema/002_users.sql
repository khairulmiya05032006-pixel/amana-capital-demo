/*
|--------------------------------------------------------------------------
| File : 002_users.sql
| Purpose : Authentication & Authorization
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS users
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_code VARCHAR(20) NOT NULL,

    email VARCHAR(150) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    role ENUM
    (
        'ADMIN',
        'CUSTOMER'
    ) NOT NULL,

    account_status ENUM
    (
        'ACTIVE',
        'INACTIVE',
        'BLOCKED'
    )
    DEFAULT 'ACTIVE',

    force_password_change BOOLEAN DEFAULT FALSE,

    last_login DATETIME NULL,

    created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_users_code
        UNIQUE(user_code),

    CONSTRAINT uk_users_email
        UNIQUE(email)

)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
