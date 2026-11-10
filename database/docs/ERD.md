# MicroFinance Database Documentation

## Entity Relationship Diagram (ERD)

```
users (1) -----> (N) customer_profiles
users (1) -----> (N) loan_applications
users (1) -----> (N) loans
users (1) -----> (N) audit_logs
customer_profiles (1) -----> (N) loan_applications
customer_profiles (1) -----> (N) loans
loan_applications (1) -----> (1) loans
loan_types (1) -----> (N) loan_applications
loan_types (1) -----> (N) loans
loans (1) -----> (N) loan_installments
loans (1) -----> (N) payments
loans (1) -----> (N) loan_transactions
loans (1) -----> (N) loan_status_history
loan_installments (1) -----> (N) payments
```

## Key Relationships

- **Users to Customers**: One user (admin) can manage multiple customers
- **Users to Loans**: One user (admin) can approve multiple loans
- **Customers to Loan Applications**: One customer can submit multiple loan applications
- **Customers to Loans**: One customer can have multiple active/inactive loans
- **Loan Applications to Loans**: One approved application creates one loan
- **Loans to Installments**: One loan generates multiple installment schedules
- **Loans to Payments**: One loan can have multiple payment records
- **Loan Types to Loans**: One loan type can be used for multiple loans

## Data Integrity

- All tables use InnoDB engine for transactional support
- Foreign keys enforce referential integrity
- Cascade and Restrict rules prevent orphaned records
- Unique constraints on business identifiers
- Timestamps track record creation and modification

## Indexes

Indexes are created on:
- Primary keys
- Foreign keys
- Frequently searched fields (user_code, customer_code, loan_number, application_number, email)
- Status fields for filtering queries
- Date fields for range queries

