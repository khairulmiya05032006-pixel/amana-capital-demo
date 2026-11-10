#!/bin/bash

# MicroFinance Database Setup Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}MicroFinance Database Setup${NC}"
echo "=============================="

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}MySQL is not installed. Please install MySQL first.${NC}"
    exit 1
fi

# Database credentials
DB_HOST="localhost"
DB_USER="root"
DB_PASSWORD="your_password_here"
DB_NAME="microfinance_db"

echo -e "${YELLOW}Connecting to MySQL...${NC}"

# Create database and run schema files
echo -e "${YELLOW}Creating database and tables...${NC}"

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/001_create_database.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/002_users.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/003_customer_profiles.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/004_loan_types.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/005_loan_applications.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/006_loans.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/007_loan_installments.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/008_payments.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/009_loan_transactions.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/010_loan_status_history.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < database/schema/011_audit_logs.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/schema/012_foreign_keys.sql

echo -e "${YELLOW}Creating indexes...${NC}"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/indexes/users_indexes.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/indexes/loans_indexes.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/indexes/payments_indexes.sql

echo -e "${YELLOW}Inserting seed data...${NC}"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/seed/admin.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/seed/loan_types.sql

echo -e "${GREEN}Database setup completed successfully!${NC}"
