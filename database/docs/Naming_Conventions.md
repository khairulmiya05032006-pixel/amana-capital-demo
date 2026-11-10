# Naming Conventions

## General Guidelines

- Use lowercase with underscores for database objects (tables, columns, functions, procedures)
- Use camelCase for JavaScript variables and functions
- Use PascalCase for class and object names
- Use UPPERCASE for constants
- Use descriptive, meaningful names
- Avoid abbreviations except for very common ones

## Table Naming

- Use plural names: `users`, `customers`, `loans`
- Prefix junction tables with neither or use natural naming: `loan_payments`
- Temporal tables: add suffix like `_archive` or `_history`

## Column Naming

- Use `id` for primary keys
- Use `{table}_id` for foreign keys: `user_id`, `customer_id`, `loan_id`
- Use boolean prefix: `is_active`, `has_collateral`
- Use `_at` suffix for timestamp columns: `created_at`, `updated_at`, `paid_at`
- Use `_count` for numeric aggregates: `payment_count`
- Use `_amount` for monetary values: `principal_amount`, `interest_amount`

## Function Naming

```sql
fn_{calculation}_{noun}      -- fn_calculate_emi
fn_generate_{identifier}     -- fn_generate_loan_number
fn_is_{condition}            -- fn_is_loan_overdue
```

## Procedure Naming

```sql
sp_{action}_{entity}         -- sp_approve_loan, sp_create_application
sp_get_{entity}              -- sp_get_loan_details
```

## Trigger Naming

```sql
trg_{timing}_{action}_{table}  -- trg_after_insert_payments
```

## View Naming

```sql
vw_{purpose}              -- vw_active_loans, vw_dashboard_summary
```

## Application Code Naming

### Controllers
- Use action verbs: `getUser`, `createLoan`, `updatePayment`
- Suffix with `Controller`: `userController.js`

### Models
- Prefix with data entity: `userModel.js`, `loanModel.js`
- Export functions with `get`, `create`, `update`, `delete` patterns

### Routes
- Use lowercase with hyphens: `/api/users`, `/api/loan-applications`
- Use plural nouns: `/loans`, `/customers`
- RESTful pattern: GET, POST, PUT, DELETE

### Middleware
- Suffix with `Middleware`: `authMiddleware.js`, `validationMiddleware.js`
- Export middleware functions: `verifyToken`, `isAdmin`

### Utilities
- Descriptive names: `bcryptUtil.js`, `emiCalculator.js`, `emailService.js`
- Export utility functions: `hashPassword`, `calculateEMI`, `sendEmail`

### Views
- Use kebab-case filenames: `user-detail.ejs`, `loan-form.ejs`
- Use directory structure for organization: `/views/admin/`, `/views/customer/`

