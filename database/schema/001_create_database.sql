/*
|--------------------------------------------------------------------------
| Project : Microfinance Loan Management System
| File    : 001_database.sql
| Purpose : Create and configure the database
| Author  : Development Team
| Version : 1.0
|--------------------------------------------------------------------------
*/

-- =====================================================
-- Drop Database (Development Only)
-- Uncomment during development if you want a fresh DB.
-- DO NOT USE IN PRODUCTION.
-- =====================================================

-- DROP DATABASE IF EXISTS microfinance_db;


-- =====================================================
-- Create Database
-- =====================================================




-- =====================================================
-- Use Database
-- =====================================================




-- =====================================================
-- Session Configuration
-- =====================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';


-- =====================================================
-- Disable Foreign Key Checks (During Schema Creation)
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;


-- =====================================================
-- Database Information
-- =====================================================

SELECT DATABASE() AS current_database;

SELECT VERSION() AS mysql_version;


-- =====================================================
-- Re-enable Foreign Keys
-- (Other schema files will execute after this)
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;
