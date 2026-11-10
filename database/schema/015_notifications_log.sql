/*
|--------------------------------------------------------------------------
| Project     : Microfinance Loan Management System
| File        : 015_notifications_log.sql
| Description : Notifications Log Table
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS notifications_log
(
    notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    loan_id BIGINT UNSIGNED NULL,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    recipient VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
    metadata JSON NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,

    PRIMARY KEY(notification_id),

    CONSTRAINT fk_notification_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_loan
        FOREIGN KEY(loan_id)
        REFERENCES loans(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
