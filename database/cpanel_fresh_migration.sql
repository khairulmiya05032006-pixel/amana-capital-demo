-- ============================================================================
-- AMANAH CAPITAL - MICROFINANCE LOAN MANAGEMENT SYSTEM
-- COMPLETE FRESH DATABASE MIGRATION SCRIPT FOR CPANEL / PRODUCTION
-- ============================================================================
-- Compatible with: MySQL 8.0+, MariaDB 10.4+, phpMyAdmin, cPanel Terminal
-- Notes:
-- 1. Does NOT contain CREATE DATABASE or USE statements, making it safe for
--    cPanel user databases (e.g., username_amanahcapital).
-- 2. Disables foreign key checks during import to ensure seamless execution.
-- 3. Drops and creates all 19 system tables with latest production schema,
--    including flat interest, whole-rupee EMI distribution, and V8 performance indexes.
-- 4. Automatically seeds initial Super Admin, loan types, loan schemes,
--    penalty policies, and initial admin working capital balance.
-- ============================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- ----------------------------------------------------------------------------
-- 1. DROP EXISTING VIEWS & TABLES (IF EXISTS)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS `vw_overdue_loans`;
DROP VIEW IF EXISTS `vw_monthly_collection`;
DROP VIEW IF EXISTS `vw_dashboard`;
DROP VIEW IF EXISTS `vw_customer_summary`;

DROP TABLE IF EXISTS `system_settings`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notifications_log`;
DROP TABLE IF EXISTS `application_status_history`;
DROP TABLE IF EXISTS `loan_status_history`;
DROP TABLE IF EXISTS `loan_transactions`;
DROP TABLE IF EXISTS `penalties`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `loan_installments`;
DROP TABLE IF EXISTS `loan_scheme_snapshots`;
DROP TABLE IF EXISTS `loans`;
DROP TABLE IF EXISTS `loan_applications`;
DROP TABLE IF EXISTS `loan_schemes`;
DROP TABLE IF EXISTS `loan_types`;
DROP TABLE IF EXISTS `penalty_settings`;
DROP TABLE IF EXISTS `admin_account_transactions`;
DROP TABLE IF EXISTS `admin_account`;
DROP TABLE IF EXISTS `customer_profiles`;
DROP TABLE IF EXISTS `users`;

-- ----------------------------------------------------------------------------
-- 2. CREATE TABLES
-- ----------------------------------------------------------------------------

-- Table: users
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','CUSTOMER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_status` enum('ACTIVE','INACTIVE','BLOCKED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `force_password_change` tinyint(1) DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_code` (`user_code`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: customer_profiles
CREATE TABLE `customer_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `customer_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('MALE','FEMALE','OTHER') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `occupation` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monthly_income` decimal(15,2) DEFAULT '0.00',
  `aadhaar_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_code` (`customer_code`),
  UNIQUE KEY `uk_customer_phone` (`phone`),
  UNIQUE KEY `uk_customer_aadhaar` (`aadhaar_number`),
  UNIQUE KEY `uk_customer_pan` (`pan_number`),
  KEY `fk_customer_user` (`user_id`),
  KEY `idx_customer_created` (`created_at`),
  CONSTRAINT `fk_customer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: admin_account
CREATE TABLE `admin_account` (
  `id` int NOT NULL AUTO_INCREMENT,
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: admin_account_transactions
CREATE TABLE `admin_account_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_type` enum('CREDIT','DEBIT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `balance_after` decimal(15,2) NOT NULL,
  `reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_created` (`created_at`),
  KEY `idx_admin_txn_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_types
CREATE TABLE `loan_types` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_type_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `loan_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `minimum_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `maximum_amount` decimal(15,2) NOT NULL,
  `minimum_interest_rate` decimal(5,2) NOT NULL,
  `maximum_interest_rate` decimal(5,2) NOT NULL,
  `minimum_duration_months` int unsigned NOT NULL,
  `maximum_duration_months` int unsigned NOT NULL,
  `processing_fee_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `late_fee_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `penalty_interest_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `display_order` int unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_loan_type_code` (`loan_type_code`),
  UNIQUE KEY `uk_loan_type_name` (`loan_name`),
  CONSTRAINT `chk_max_amount` CHECK ((`maximum_amount` >= `minimum_amount`)),
  CONSTRAINT `chk_max_duration` CHECK ((`maximum_duration_months` >= `minimum_duration_months`)),
  CONSTRAINT `chk_max_interest` CHECK ((`maximum_interest_rate` >= `minimum_interest_rate`)),
  CONSTRAINT `chk_min_amount` CHECK ((`minimum_amount` >= 0)),
  CONSTRAINT `chk_min_duration` CHECK ((`minimum_duration_months` > 0)),
  CONSTRAINT `chk_min_interest` CHECK ((`minimum_interest_rate` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_schemes
CREATE TABLE `loan_schemes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scheme_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheme_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `version` int NOT NULL DEFAULT '1',
  `parent_scheme_id` bigint unsigned DEFAULT NULL,
  `status` enum('DRAFT','ACTIVE','INACTIVE','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `interest_type` enum('FLAT','REDUCING_BALANCE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_interest_rate` decimal(7,4) NOT NULL,
  `base_interest_amount` decimal(15,2) DEFAULT '0.00',
  `repayment_frequency` enum('DAILY','WEEKLY','MONTHLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_value` int NOT NULL,
  `duration_unit` enum('DAYS','WEEKS','MONTHS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `grace_period_days` int NOT NULL DEFAULT '0',
  `penalty_type` enum('FIXED','PERCENTAGE','NONE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NONE',
  `penalty_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `processing_fee_type` enum('FIXED','PERCENTAGE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERCENTAGE',
  `processing_fee_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scheme_code_version` (`scheme_code`,`version`),
  KEY `fk_scheme_parent` (`parent_scheme_id`),
  KEY `fk_scheme_created_by` (`created_by`),
  CONSTRAINT `fk_scheme_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_scheme_parent` FOREIGN KEY (`parent_scheme_id`) REFERENCES `loan_schemes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_applications
CREATE TABLE `loan_applications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `loan_type_id` bigint unsigned DEFAULT NULL,
  `loan_scheme_id` bigint unsigned DEFAULT NULL,
  `requested_amount` decimal(15,2) NOT NULL,
  `approved_principal` decimal(15,2) DEFAULT NULL,
  `approved_interest_amount` decimal(15,2) DEFAULT NULL,
  `approved_rounding_adjustment` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_payable` decimal(15,2) DEFAULT NULL,
  `interest_calculation_method` enum('PERCENTAGE','FLAT_AMOUNT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FLAT_AMOUNT',
  `requested_interest_rate` decimal(5,2) DEFAULT NULL,
  `requested_duration_months` smallint unsigned DEFAULT NULL,
  `purpose` text COLLATE utf8mb4_unicode_ci,
  `monthly_income` decimal(15,2) NOT NULL DEFAULT '0.00',
  `existing_loan_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `collateral_details` text COLLATE utf8mb4_unicode_ci,
  `guarantor_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guarantor_phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `application_status` enum('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `admin_remarks` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL COMMENT 'Admin user ID who approved',
  `approved_at` datetime DEFAULT NULL COMMENT 'Timestamp of approval decision',
  `reviewed_at` datetime DEFAULT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_application_number` (`application_number`),
  KEY `fk_app_scheme` (`loan_scheme_id`),
  KEY `idx_application_customer` (`customer_id`),
  KEY `idx_application_status` (`application_status`),
  KEY `idx_application_type` (`loan_type_id`),
  KEY `idx_application_date` (`applied_at`),
  KEY `idx_application_reviewed` (`reviewed_by`),
  KEY `idx_applications_status` (`application_status`),
  KEY `idx_applications_created` (`created_at`),
  KEY `idx_applications_customer_status` (`customer_id`,`application_status`),
  CONSTRAINT `fk_app_scheme` FOREIGN KEY (`loan_scheme_id`) REFERENCES `loan_schemes` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_application_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_application_loan_type` FOREIGN KEY (`loan_type_id`) REFERENCES `loan_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_application_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_monthly_income` CHECK ((`monthly_income` >= 0)),
  CONSTRAINT `chk_requested_amount` CHECK ((`requested_amount` > 0)),
  CONSTRAINT `chk_requested_duration` CHECK ((`requested_duration_months` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loans
CREATE TABLE `loans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `loan_source` enum('CUSTOMER_APPLICATION','DIRECT_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CUSTOMER_APPLICATION',
  `created_by_admin_id` bigint unsigned DEFAULT NULL,
  `approval_type` enum('MANUAL','AUTOMATIC','DIRECT_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MANUAL',
  `application_id` bigint unsigned DEFAULT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `loan_type_id` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned NOT NULL,
  `principal_amount` decimal(15,2) NOT NULL,
  `flat_interest_amount` decimal(15,2) DEFAULT '0.00',
  `rounding_adjustment` decimal(15,2) NOT NULL DEFAULT '0.00',
  `annual_interest_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tenure_months` smallint unsigned NOT NULL,
  `emi_amount` decimal(15,2) NOT NULL,
  `total_interest` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_payable` decimal(15,2) NOT NULL,
  `outstanding_balance` decimal(15,2) NOT NULL,
  `disbursement_date` date NOT NULL,
  `first_installment_date` date NOT NULL,
  `maturity_date` date NOT NULL,
  `interest_calculation_method` enum('PERCENTAGE','FLAT_AMOUNT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FLAT_AMOUNT',
  `repayment_frequency` enum('DAILY','WEEKLY','MONTHLY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MONTHLY',
  `loan_status` enum('ACTIVE','COMPLETED','DEFAULTED','WRITTEN_OFF','CLOSED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_loan_number` (`loan_number`),
  KEY `fk_loan_type` (`loan_type_id`),
  KEY `fk_loan_admin` (`approved_by`),
  KEY `fk_loan_creator` (`created_by_admin_id`),
  KEY `idx_loans_customer` (`customer_id`),
  KEY `idx_loans_status` (`loan_status`),
  KEY `idx_loans_application` (`application_id`),
  KEY `idx_loans_disbursement` (`disbursement_date`),
  KEY `idx_loans_maturity` (`maturity_date`),
  KEY `idx_loans_disbursement_date` (`disbursement_date`),
  KEY `idx_loans_customer_status` (`customer_id`,`loan_status`),
  CONSTRAINT `fk_loan_admin` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loan_application` FOREIGN KEY (`application_id`) REFERENCES `loan_applications` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loan_creator` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_loan_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loan_type` FOREIGN KEY (`loan_type_id`) REFERENCES `loan_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_emi` CHECK ((`emi_amount` > 0)),
  CONSTRAINT `chk_interest` CHECK ((`annual_interest_rate` >= 0)),
  CONSTRAINT `chk_payable` CHECK ((`total_payable` >= `principal_amount`)),
  CONSTRAINT `chk_principal` CHECK ((`principal_amount` > 0)),
  CONSTRAINT `chk_tenure` CHECK ((`tenure_months` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_scheme_snapshots
CREATE TABLE `loan_scheme_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_id` bigint unsigned NOT NULL,
  `scheme_id` bigint unsigned NOT NULL,
  `scheme_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheme_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheme_version` int NOT NULL,
  `interest_type` enum('FLAT','REDUCING_BALANCE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `interest_rate` decimal(7,4) NOT NULL,
  `interest_amount` decimal(15,2) DEFAULT '0.00',
  `rounding_adjustment` decimal(15,2) NOT NULL DEFAULT '0.00',
  `interest_calculation_method` enum('PERCENTAGE','FLAT_AMOUNT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FLAT_AMOUNT',
  `repayment_frequency` enum('DAILY','WEEKLY','MONTHLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_value` int NOT NULL,
  `duration_unit` enum('DAYS','WEEKS','MONTHS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `grace_period_days` int NOT NULL DEFAULT '0',
  `penalty_type` enum('FIXED','PERCENTAGE','NONE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NONE',
  `penalty_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `processing_fee_type` enum('FIXED','PERCENTAGE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERCENTAGE',
  `processing_fee_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loan_id` (`loan_id`),
  KEY `fk_snapshot_scheme` (`scheme_id`),
  CONSTRAINT `fk_snapshot_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_scheme` FOREIGN KEY (`scheme_id`) REFERENCES `loan_schemes` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_installments
CREATE TABLE `loan_installments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_id` bigint unsigned NOT NULL,
  `installment_number` smallint unsigned NOT NULL,
  `payment_frequency` enum('DAILY','WEEKLY','MONTHLY') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date NOT NULL,
  `opening_balance` decimal(15,2) NOT NULL,
  `principal_amount` decimal(15,2) NOT NULL,
  `interest_amount` decimal(15,2) NOT NULL,
  `rounding_adjustment` decimal(15,2) NOT NULL DEFAULT '0.00',
  `penalty_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` decimal(15,2) NOT NULL,
  `closing_balance` decimal(15,2) NOT NULL,
  `installment_status` enum('PENDING','PARTIALLY_PAID','PAID','OVERDUE','WAIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `paid_date` date DEFAULT NULL,
  `remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `schedule_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_loan_installment` (`loan_id`,`installment_number`),
  KEY `idx_installment_loan` (`loan_id`),
  KEY `idx_installment_due_date` (`due_date`),
  KEY `idx_installment_status` (`installment_status`),
  KEY `idx_installment_paid_date` (`paid_date`),
  KEY `idx_installments_status` (`installment_status`),
  KEY `idx_installments_due_date` (`due_date`),
  KEY `idx_installments_status_due` (`installment_status`,`due_date`),
  KEY `idx_installments_loan_status` (`loan_id`,`installment_status`),
  CONSTRAINT `fk_installment_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_installment_interest` CHECK ((`interest_amount` >= 0)),
  CONSTRAINT `chk_installment_paid` CHECK ((`paid_amount` >= 0)),
  CONSTRAINT `chk_installment_penalty` CHECK ((`penalty_amount` >= 0)),
  CONSTRAINT `chk_installment_principal` CHECK ((`principal_amount` >= 0)),
  CONSTRAINT `chk_installment_remaining` CHECK ((`remaining_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: payments
CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `loan_id` bigint unsigned NOT NULL,
  `installment_id` bigint unsigned NOT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `collected_by` bigint unsigned NOT NULL,
  `payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_amount` decimal(15,2) NOT NULL,
  `principal_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `interest_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `penalty_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('CASH','UPI','BANK_TRANSFER','CHEQUE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receipt_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` enum('SUCCESS','PENDING','FAILED','REVERSED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SUCCESS',
  `remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_number` (`payment_number`),
  UNIQUE KEY `uk_receipt_number` (`receipt_number`),
  KEY `idx_payment_customer` (`customer_id`),
  KEY `idx_payment_loan` (`loan_id`),
  KEY `idx_payment_installment` (`installment_id`),
  KEY `idx_payment_date` (`payment_date`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_payment_collector` (`collected_by`),
  KEY `idx_payments_date` (`payment_date`),
  KEY `idx_payments_loan_date` (`loan_id`,`payment_date`),
  KEY `idx_payments_method` (`payment_method`),
  CONSTRAINT `fk_payment_collector` FOREIGN KEY (`collected_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_installment` FOREIGN KEY (`installment_id`) REFERENCES `loan_installments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_interest_paid` CHECK ((`interest_paid` >= 0)),
  CONSTRAINT `chk_payment_amount` CHECK ((`payment_amount` > 0)),
  CONSTRAINT `chk_payment_breakup` CHECK ((`payment_amount` = ((`principal_paid` + `interest_paid`) + `penalty_paid`))),
  CONSTRAINT `chk_penalty_paid` CHECK ((`penalty_paid` >= 0)),
  CONSTRAINT `chk_principal_paid` CHECK ((`principal_paid` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: penalties
CREATE TABLE `penalties` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_id` bigint unsigned NOT NULL,
  `installment_id` bigint unsigned NOT NULL,
  `penalty_amount` decimal(15,2) NOT NULL,
  `penalty_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `policy_version` int NOT NULL DEFAULT '1',
  `status` enum('APPLIED','WAIVED','UNPAID','PARTIALLY_PAID','PAID') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPLIED',
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_installment_penalty_type` (`installment_id`,`penalty_type`),
  KEY `fk_penalties_loan` (`loan_id`),
  KEY `idx_penalties_status` (`status`),
  CONSTRAINT `fk_penalties_installment` FOREIGN KEY (`installment_id`) REFERENCES `loan_installments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_penalties_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_transactions
CREATE TABLE `loan_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `transaction_number` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `loan_id` bigint unsigned NOT NULL,
  `installment_id` bigint unsigned DEFAULT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `customer_id` bigint unsigned NOT NULL,
  `transaction_type` enum('DISBURSEMENT','PAYMENT','PENALTY','INTEREST','WAIVER','REFUND','ADJUSTMENT','WRITE_OFF') COLLATE utf8mb4_unicode_ci NOT NULL,
  `disbursement_type` enum('NORMAL','DIRECT','RESTRUCTURE','TOPUP') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `debit_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `running_balance` decimal(15,2) NOT NULL,
  `transaction_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_transaction_number` (`transaction_number`),
  KEY `fk_transaction_installment` (`installment_id`),
  KEY `idx_transaction_loan` (`loan_id`),
  KEY `idx_transaction_customer` (`customer_id`),
  KEY `idx_transaction_payment` (`payment_id`),
  KEY `idx_transaction_date` (`transaction_date`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_transaction_created_by` (`created_by`),
  KEY `idx_transactions_date` (`transaction_date`),
  KEY `idx_transactions_type` (`transaction_type`),
  CONSTRAINT `fk_transaction_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_transaction_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_transaction_installment` FOREIGN KEY (`installment_id`) REFERENCES `loan_installments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_transaction_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_transaction_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_credit_amount` CHECK ((`credit_amount` >= 0)),
  CONSTRAINT `chk_debit_amount` CHECK ((`debit_amount` >= 0)),
  CONSTRAINT `chk_running_balance` CHECK ((`running_balance` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_status_history
CREATE TABLE `loan_status_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `loan_id` bigint unsigned NOT NULL,
  `old_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` bigint unsigned DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_loan_status_history_loan` (`loan_id`),
  CONSTRAINT `fk_loan_status_history_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: application_status_history
CREATE TABLE `application_status_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `previous_status` enum('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` bigint unsigned NOT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_application_history_application` (`application_id`),
  KEY `idx_application_history_new_status` (`new_status`),
  KEY `idx_application_history_changed_by` (`changed_by`),
  KEY `idx_application_history_changed_at` (`changed_at`),
  CONSTRAINT `fk_application_status_history_application` FOREIGN KEY (`application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_application_status_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: notifications_log
CREATE TABLE `notifications_log` (
  `notification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `loan_id` bigint unsigned DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EMAIL',
  `recipient` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','SENT','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SENT',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `fk_notification_user` (`user_id`),
  KEY `fk_notification_loan` (`loan_id`),
  CONSTRAINT `fk_notification_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: audit_logs
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `module_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_method` enum('GET','POST','PUT','PATCH','DELETE') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_module` (`module_name`),
  KEY `idx_audit_entity` (`entity_name`,`entity_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_created_at` (`created_at`),
  KEY `idx_audit_ip` (`ip_address`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_module_created` (`module_name`,`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: penalty_settings
CREATE TABLE `penalty_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `repayment_frequency` enum('DAILY','WEEKLY','MONTHLY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculation_method` enum('PERCENTAGE_OF_OVERDUE','FIXED_AMOUNT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERCENTAGE_OF_OVERDUE',
  `penalty_rate` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `fixed_penalty_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `grace_period_days` int unsigned NOT NULL DEFAULT '0',
  `maximum_penalty_cap` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `auto_apply` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_penalty_frequency` (`repayment_frequency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: system_settings
CREATE TABLE `system_settings` (
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. CREATE PERFORMANCE VIEWS (DEFINER-FREE FOR CPANEL COMPATIBILITY)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW `vw_customer_summary` AS
SELECT 
  c.user_id AS customer_id,
  COUNT(l.id) AS total_loans,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_loans,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN l.outstanding_balance ELSE 0 END) AS total_outstanding_balance,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN l.principal_amount ELSE 0 END) AS active_loan_amount
FROM customer_profiles c
LEFT JOIN loans l ON c.id = l.customer_id
GROUP BY c.user_id;

CREATE OR REPLACE VIEW `vw_dashboard` AS
SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER') AS total_customers,
  (SELECT COUNT(*) FROM loans WHERE loan_status = 'ACTIVE') AS active_loans,
  (SELECT COALESCE(SUM(principal_amount), 0) FROM loans) AS total_money_lent,
  (SELECT COUNT(*) FROM loan_applications WHERE application_status = 'APPROVED') AS approved_loans,
  (SELECT COALESCE(SUM(payment_amount), 0) FROM payments WHERE DATE(payment_date) = CURDATE()) AS todays_collections,
  (SELECT COALESCE(SUM(outstanding_balance), 0) FROM loans WHERE loan_status = 'ACTIVE') AS outstanding_balance,
  (SELECT COALESCE(SUM(remaining_amount), 0) FROM loan_installments WHERE installment_status = 'OVERDUE') AS overdue_amount,
  (SELECT COUNT(*) FROM loans WHERE loan_status = 'CLOSED') AS closed_loans,
  (SELECT COALESCE(SUM(payment_amount), 0) FROM payments WHERE payment_status = 'SUCCESS') AS total_repayments_received;

CREATE OR REPLACE VIEW `vw_monthly_collection` AS
SELECT 
  DATE_FORMAT(payment_date, '%Y-%m') AS collection_month,
  SUM(payment_amount) AS total_collected,
  COUNT(id) AS number_of_payments
FROM payments
GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
ORDER BY collection_month DESC;

CREATE OR REPLACE VIEW `vw_overdue_loans` AS
SELECT 
  l.id AS loan_id,
  l.loan_number,
  c.full_name AS customer_name,
  c.phone AS customer_phone,
  i.due_date,
  i.total_amount AS installment_amount,
  i.penalty_amount,
  (i.total_amount + i.penalty_amount - i.paid_amount) AS amount_due
FROM loan_installments i
JOIN loans l ON i.loan_id = l.id
JOIN customer_profiles c ON l.customer_id = c.id
WHERE i.installment_status = 'OVERDUE' AND l.loan_status = 'ACTIVE';

-- ----------------------------------------------------------------------------
-- 4. SEED CORE DATA
-- ----------------------------------------------------------------------------

-- Seed Super Admin (Credentials: admin@microfinance.com / Admin@123)
INSERT INTO `users` (`id`, `user_code`, `email`, `password_hash`, `role`, `account_status`, `force_password_change`)
VALUES (1, 'ADM001', 'admin@microfinance.com', '$2b$10$jNrH0y1Yz6unq7yFadhUkeE24xBsjFDeAMM8tZzgy0aG3MWZwX4Sa', 'ADMIN', 'ACTIVE', 0)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Seed Admin Liquidity Account with initial float
INSERT INTO `admin_account` (`id`, `balance`)
VALUES (1, 100000.00)
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`);

-- Seed Default Loan Types
INSERT INTO `loan_types` (`id`, `loan_type_code`, `loan_name`, `description`, `minimum_amount`, `maximum_amount`, `minimum_interest_rate`, `maximum_interest_rate`, `minimum_duration_months`, `maximum_duration_months`, `processing_fee_percentage`, `late_fee_percentage`, `penalty_interest_percentage`, `is_active`, `display_order`)
VALUES
  (1, 'PL01', 'Personal Loan', 'Standard microfinance personal loan for individual borrowers.', 1000.00, 500000.00, 5.00, 24.00, 1, 60, 2.00, 5.00, 2.00, 1, 1),
  (2, 'BL01', 'Business Loan', 'Working capital and small business expansion loan.', 5000.00, 2000000.00, 5.00, 30.00, 1, 120, 1.50, 5.00, 2.00, 1, 2)
ON DUPLICATE KEY UPDATE `loan_name` = VALUES(`loan_name`);

-- Seed Default Active Loan Schemes (Monthly, Weekly, Daily)
INSERT INTO `loan_schemes` (`id`, `scheme_code`, `scheme_name`, `description`, `version`, `parent_scheme_id`, `status`, `interest_type`, `base_interest_rate`, `base_interest_amount`, `repayment_frequency`, `duration_value`, `duration_unit`, `grace_period_days`, `penalty_type`, `penalty_value`, `processing_fee_type`, `processing_fee_value`, `created_by`)
VALUES
  (1, 'STD_MONTHLY', 'Standard Monthly Personal Loan', 'Monthly installment loan scheme with flexible flat interest amount.', 1, NULL, 'ACTIVE', 'FLAT', 12.0000, 0.00, 'MONTHLY', 12, 'MONTHS', 0, 'PERCENTAGE', 2.00, 'PERCENTAGE', 1.50, 1),
  (2, 'STD_WEEKLY', 'Standard Weekly Microloan', 'Weekly repayment microloan scheme for weekly cash-flow businesses.', 1, NULL, 'ACTIVE', 'FLAT', 10.0000, 0.00, 'WEEKLY', 24, 'WEEKS', 1, 'FIXED', 50.00, 'FIXED', 500.00, 1),
  (3, 'STD_DAILY', 'Standard Daily Loan', 'Daily collection loan scheme for street vendors and small merchants.', 1, NULL, 'ACTIVE', 'FLAT', 5.0000, 0.00, 'DAILY', 30, 'DAYS', 0, 'FIXED', 10.00, 'PERCENTAGE', 1.00, 1)
ON DUPLICATE KEY UPDATE `scheme_name` = VALUES(`scheme_name`);

-- Seed Penalty Settings by Frequency
INSERT INTO `penalty_settings` (`id`, `repayment_frequency`, `calculation_method`, `penalty_rate`, `fixed_penalty_amount`, `grace_period_days`, `maximum_penalty_cap`, `auto_apply`, `is_active`, `version`)
VALUES
  (1, 'DAILY', 'PERCENTAGE_OF_OVERDUE', 2.0000, 0.00, 0, 15.0000, 1, 1, 1),
  (2, 'WEEKLY', 'PERCENTAGE_OF_OVERDUE', 2.5000, 0.00, 1, 15.0000, 1, 1, 1),
  (3, 'MONTHLY', 'PERCENTAGE_OF_OVERDUE', 3.0000, 0.00, 7, 15.0000, 1, 1, 1)
ON DUPLICATE KEY UPDATE `calculation_method` = VALUES(`calculation_method`), `penalty_rate` = VALUES(`penalty_rate`);

-- Seed Default System Settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `updated_by`)
VALUES
  ('company_name', 'Amanah Capital Microfinance', 1),
  ('currency_symbol', '₹', 1),
  ('time_zone', 'Asia/Kolkata', 1),
  ('penalty_rate', '2.00', 1)
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- ----------------------------------------------------------------------------
-- 5. RESTORE SYSTEM SETTINGS
-- ----------------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
SET SQL_MODE=@OLD_SQL_MODE;

-- ============================================================================
-- MIGRATION COMPLETE!
-- Default Admin Login:
-- Email:    admin@microfinance.com
-- Password: Admin@123
-- ============================================================================
