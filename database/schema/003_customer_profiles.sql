/*
|--------------------------------------------------------------------------
| File : 003_customer_profiles.sql
| Purpose : Customer Profile
|--------------------------------------------------------------------------
*/



CREATE TABLE IF NOT EXISTS customer_profiles
(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    customer_code VARCHAR(20) NOT NULL,

    full_name VARCHAR(120) NOT NULL,

    phone VARCHAR(15) NOT NULL,

    date_of_birth DATE NULL,

    gender ENUM
    (
        'MALE',
        'FEMALE',
        'OTHER'
    ),

    address TEXT,

    occupation VARCHAR(100),

    monthly_income DECIMAL(15,2)
    DEFAULT 0.00,

    aadhaar_number VARCHAR(20),

    pan_number VARCHAR(20),

    photo_url VARCHAR(500),

    profile_status ENUM
    (
        'ACTIVE',
        'INACTIVE'
    )
    DEFAULT 'ACTIVE',

    created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT uk_customer_code
        UNIQUE(customer_code),

    CONSTRAINT uk_customer_phone
        UNIQUE(phone),

    CONSTRAINT uk_customer_aadhaar
        UNIQUE(aadhaar_number),

    CONSTRAINT uk_customer_pan
        UNIQUE(pan_number),

    CONSTRAINT fk_customer_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
