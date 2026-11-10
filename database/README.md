# Microfinance Loan Management System — Database Documentation

This document explains the complete database design, business rules, relationships, and working flow of the system, so any developer joining the project can understand how data moves from **customer registration → loan application → approval → EMI generation → payment → loan closure**.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Business Rules](#2-business-rules)
3. [System Workflow](#3-system-workflow)
4. [ER Diagram](#4-er-diagram)
5. [Database Architecture](#5-database-architecture)
6. [Table Definitions](#6-table-definitions)
7. [Data Dictionary (Key Formulas)](#7-data-dictionary-key-formulas)
8. [Relationships](#8-relationships)
9. [Stored Procedures](#9-stored-procedures)
10. [Triggers](#10-triggers)
11. [Views](#11-views)
12. [Indexing Strategy](#12-indexing-strategy)
13. [Security](#13-security)
14. [Naming Conventions](#14-naming-conventions)
15. [Backup & Recovery](#15-backup--recovery)
16. [API → Database Mapping](#16-api--database-mapping)
17. [Module Build Order](#17-module-build-order)
18. [Future Scalability](#18-future-scalability)

---

## 1. System Overview

**Project:** Microfinance Loan Management System

**Actors:**
- **Customer** — registers, applies for a loan, tracks EMI, views payment history.
- **Admin** — reviews applications, approves/rejects, generates EMI schedules, records payments, views reports.

**Modules:** Authentication · Customer Management · Loan Application · Loan Management · EMI Management · Payment Management · Reports · Dashboard · Audit Logs

**Customer flow:**
```
Register → Login → Apply Loan → Track Loan → View EMI → View Payment History → Logout
```

**Admin flow:**
```
Login → Dashboard → Manage Customers → Approve/Reject Loan → Generate EMI → Receive Payment → Reports
```

---

## 2. Business Rules

| ID | Rule |
|----|------|
| BR-001 | A customer must register before applying for a loan. |
| BR-002 | Email must be unique per user. |
| BR-003 | Phone number must be unique per user. |
| BR-004 | One approved application creates exactly one loan. Rejected applications never create a loan record. |
| BR-005 | A payment amount can never exceed the remaining outstanding balance on a loan. |
| BR-006 | EMI installments are generated only after a loan is created (post-approval), never before. |
| BR-007 | A loan is marked `CLOSED` only when `remaining_balance = 0`. |
| BR-008 | Every status change (application, loan, installment) must be recorded in a history/audit table. |
| BR-009 | Soft delete only — no hard deletes on financial records (`users`, `loans`, `payments`). |

---

## 3. System Workflow

```
Register
   │
   ▼
users
   │
   ▼
Loan Apply ───────────► loan_applications (status: PENDING)
   │
   ▼
Admin Review
   │
   ├── Reject ──► loan_applications (status: REJECTED) ──► END
   │
   └── Approve ──► loans (status: ACTIVE)
                      │
                      ▼
              Generate EMI Schedule
                      │
                      ▼
              loan_installments (N rows, status: PENDING)
                      │
                      ▼
                 Receive Payment
                      │
                      ▼
              payments + loan_transactions
                      │
                      ▼
        Update loan_installments.status → PAID
                      │
                      ▼
        Update loans.remaining_balance
                      │
                      ▼
          All installments PAID? ──► loans.status = CLOSED
                      │
                      ▼
                  Dashboard / Reports
```

---

## 4. ER Diagram

```
                        USERS
                          │ 1
                          │
                          ▼
                 LOAN_APPLICATIONS
                          │ 1 (on approval)
                          │
                          ▼
                        LOANS
              ┌───────────┴───────────┐
              │ 1                     │ 1
              ▼                       ▼
     LOAN_INSTALLMENTS         LOAN_TRANSACTIONS
              │ 1
              │
              ▼
           PAYMENTS

     ADMINS
        │
        ├──────────────► AUDIT_LOGS
        └──────────────► LOAN_STATUS_HISTORY

     LOAN_TYPES ─────────► LOAN_APPLICATIONS (reference)
```

**Cardinality summary**

| Parent | Child | Relationship |
|--------|-------|---------------|
| users | loan_applications | 1 → many |
| loan_applications | loans | 1 → 1 (only if approved) |
| loans | loan_installments | 1 → many |
| loan_installments | payments | 1 → many (partial payments allowed) |
| loans | loan_transactions | 1 → many |
| admins | audit_logs | 1 → many |

---

## 5. Database Architecture

**Master tables** (relatively static reference data)
```
users
loan_types
admins
```

**Transaction tables** (change frequently, drive the business process)
```
loan_applications
loans
loan_installments
payments
loan_transactions
```

**History / audit tables** (append-only, never updated)
```
audit_logs
loan_status_history
```

Separating tables this way keeps master data clean, isolates high-write transaction tables for indexing/performance tuning, and keeps a full audit trail independent of live operational data.

---

## 6. Table Definitions

### `users`
Stores customer login credentials and profile data.

| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK, AUTO_INCREMENT | Internal unique ID |
| customer_code | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable customer code (e.g. CUST0001) |
| full_name | VARCHAR(120) | NOT NULL | Customer's full name |
| email | VARCHAR(150) | UNIQUE, NOT NULL | Login email (BR-002) |
| phone | VARCHAR(15) | UNIQUE, NOT NULL | Contact number (BR-003) |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt/Argon2 hash — never store plaintext |
| status | ENUM('ACTIVE','INACTIVE','BLOCKED') | DEFAULT 'ACTIVE' | Account status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration date |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last profile update |
| deleted_at | TIMESTAMP | NULL | Soft-delete marker (BR-009) |

### `admins`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | Internal ID |
| name | VARCHAR(120) | NOT NULL | Admin name |
| email | VARCHAR(150) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| role | ENUM('SUPER_ADMIN','LOAN_OFFICER','SUPPORT') | DEFAULT 'LOAN_OFFICER' | RBAC role |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |

### `loan_types`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | INT | PK | — |
| name | VARCHAR(60) | NOT NULL | e.g. "Personal Loan", "Business Loan" |
| interest_rate | DECIMAL(5,2) | NOT NULL | Annual interest rate (%) |
| min_amount | DECIMAL(12,2) | NOT NULL | Minimum loan amount |
| max_amount | DECIMAL(12,2) | NOT NULL | Maximum loan amount |
| max_tenure_months | INT | NOT NULL | Maximum repayment period |

### `loan_applications`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| user_id | BIGINT | FK → users.id | Applicant |
| loan_type_id | INT | FK → loan_types.id | Requested loan type |
| requested_amount | DECIMAL(12,2) | NOT NULL | Amount requested |
| tenure_months | INT | NOT NULL | Requested repayment period |
| status | ENUM('PENDING','APPROVED','REJECTED') | DEFAULT 'PENDING' | Application state (BR-004) |
| reviewed_by | BIGINT | FK → admins.id, NULL | Admin who reviewed it |
| applied_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |
| reviewed_at | TIMESTAMP | NULL | — |

### `loans`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| application_id | BIGINT | FK → loan_applications.id, UNIQUE | One-to-one link (BR-004) |
| user_id | BIGINT | FK → users.id | Borrower |
| principal_amount | DECIMAL(12,2) | NOT NULL | Approved principal |
| interest_rate | DECIMAL(5,2) | NOT NULL | Locked-in rate at approval |
| tenure_months | INT | NOT NULL | Approved repayment period |
| total_payable | DECIMAL(12,2) | NOT NULL | Principal + total interest |
| remaining_balance | DECIMAL(12,2) | NOT NULL | Outstanding amount (BR-007) |
| status | ENUM('ACTIVE','CLOSED','DEFAULTED') | DEFAULT 'ACTIVE' | Loan state |
| disbursed_at | TIMESTAMP | NULL | Disbursement date |
| closed_at | TIMESTAMP | NULL | Set when balance reaches 0 |

### `loan_installments`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| loan_id | BIGINT | FK → loans.id | Parent loan |
| installment_no | INT | NOT NULL | Sequence (1, 2, 3 …) |
| due_date | DATE | NOT NULL | EMI due date |
| emi_amount | DECIMAL(12,2) | NOT NULL | Amount due this cycle |
| paid_amount | DECIMAL(12,2) | DEFAULT 0 | Amount actually paid |
| status | ENUM('PENDING','PARTIAL','PAID','OVERDUE') | DEFAULT 'PENDING' | Installment state |

### `payments`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| installment_id | BIGINT | FK → loan_installments.id | Installment being paid |
| loan_id | BIGINT | FK → loans.id | Denormalized for fast lookups |
| amount | DECIMAL(12,2) | NOT NULL | Payment amount (BR-005 enforced at app/proc level) |
| payment_method | ENUM('CASH','UPI','BANK_TRANSFER','CARD') | NOT NULL | — |
| payment_date | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |
| received_by | BIGINT | FK → admins.id, NULL | Admin who recorded it (if manual) |

### `loan_transactions`
Ledger-style append-only record of every balance-affecting event on a loan.

| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| loan_id | BIGINT | FK → loans.id | — |
| transaction_type | ENUM('DISBURSEMENT','PAYMENT','PENALTY','ADJUSTMENT') | NOT NULL | — |
| amount | DECIMAL(12,2) | NOT NULL | — |
| balance_after | DECIMAL(12,2) | NOT NULL | Running balance after this entry |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |

### `audit_logs`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| actor_type | ENUM('USER','ADMIN','SYSTEM') | NOT NULL | Who triggered the action |
| actor_id | BIGINT | NULL | FK to users/admins depending on actor_type |
| action | VARCHAR(100) | NOT NULL | e.g. "LOAN_APPROVED" |
| table_name | VARCHAR(60) | NOT NULL | Affected table |
| record_id | BIGINT | NOT NULL | Affected row |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |

### `loan_status_history`
| Column | Type | Constraints | Description |
|--------|------|-------------|--------------|
| id | BIGINT | PK | — |
| loan_id | BIGINT | FK → loans.id | — |
| old_status | VARCHAR(30) | — | — |
| new_status | VARCHAR(30) | NOT NULL | — |
| changed_by | BIGINT | FK → admins.id, NULL | — |
| changed_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | — |

---

## 7. Data Dictionary (Key Formulas)

**Remaining balance**
```
remaining_balance = total_payable - SUM(payments.amount for this loan)
```
Example: loan of ₹100,000 total payable, ₹25,000 paid → remaining_balance = ₹75,000.

**Total payable (simple flat-rate example)**
```
total_payable = principal_amount + (principal_amount * interest_rate/100 * tenure_months/12)
```

**EMI amount**
```
emi_amount = total_payable / tenure_months
```

**Installment status**
```
paid_amount = 0            → PENDING
0 < paid_amount < emi_amount → PARTIAL
paid_amount >= emi_amount   → PAID
due_date < today AND status != PAID → OVERDUE
```

---

## 8. Relationships

| From | To | Type | Explanation |
|------|----|----|-------------|
| users | loan_applications | 1 : N | One customer can submit multiple applications over time. |
| loan_applications | loans | 1 : 1 | Each approved application creates exactly one loan (BR-004). |
| loans | loan_installments | 1 : N | Each loan generates a fixed EMI schedule. |
| loan_installments | payments | 1 : N | An installment may be paid in multiple partial payments. |
| loans | loan_transactions | 1 : N | Every balance-affecting event is logged. |
| admins | audit_logs | 1 : N | Every admin action is traceable. |
| admins | loan_status_history | 1 : N | Every status change is traceable to the admin who made it. |

---

## 9. Stored Procedures

### `sp_approve_application(application_id, admin_id)`
```
1. Validate application status = PENDING
2. Update loan_applications.status = APPROVED, reviewed_by, reviewed_at
3. INSERT INTO loans (principal_amount, interest_rate, tenure_months, total_payable, remaining_balance = total_payable, status = ACTIVE)
4. CALL sp_generate_emi_schedule(new_loan_id)
5. INSERT INTO loan_transactions (type = DISBURSEMENT)
6. INSERT INTO audit_logs
```

### `sp_generate_emi_schedule(loan_id)`
```
1. Read loans.total_payable, tenure_months
2. FOR i in 1..tenure_months:
     INSERT INTO loan_installments (installment_no = i, due_date = disbursed_at + i months, emi_amount, status = PENDING)
```

### `sp_record_payment(installment_id, amount, method, admin_id)`
```
1. Validate amount <= (emi_amount - paid_amount)     -- BR-005
2. INSERT INTO payments
3. UPDATE loan_installments.paid_amount += amount, status recalculated
4. UPDATE loans.remaining_balance -= amount
5. INSERT INTO loan_transactions (type = PAYMENT, balance_after)
6. IF loans.remaining_balance = 0:
     UPDATE loans.status = CLOSED, closed_at = now()   -- BR-007
7. INSERT INTO audit_logs
```

---

## 10. Triggers

### `trg_after_payment_insert`
```
AFTER INSERT ON payments
  → Recalculate loan_installments.status for the affected installment
  → Recalculate loans.remaining_balance
  → IF remaining_balance = 0 THEN set loans.status = CLOSED
```

### `trg_after_loan_status_change`
```
AFTER UPDATE ON loans (when status column changes)
  → INSERT INTO loan_status_history (old_status, new_status, changed_by)
```

---

## 11. Views

| View | Purpose |
|------|---------|
| `vw_dashboard` | Aggregated counts for admin dashboard (active loans, pending applications, today's collections). |
| `vw_active_loans` | All loans with `status = ACTIVE`, joined with borrower name and next due date. |
| `vw_overdue_loans` | Loans with at least one `OVERDUE` installment. |
| `vw_monthly_collection` | Sum of payments grouped by month, for reporting. |
| `vw_customer_summary` | Per-customer total loans, total paid, current outstanding. |

---

## 12. Indexing Strategy

| Table | Column(s) | Index Type | Reason |
|-------|-----------|------------|--------|
| users | email | UNIQUE | Fast login lookups |
| users | phone | UNIQUE | Enforce BR-003 |
| loans | status | INDEX | Dashboard filters by status |
| loan_installments | (loan_id, due_date) | COMPOSITE | Fast EMI schedule + overdue queries |
| payments | payment_date | INDEX | Date-range reports |
| loan_applications | status | INDEX | Admin review queue |

---

## 13. Security

- **Password hashing** — bcrypt/Argon2, never plaintext, never reversible encryption.
- **JWT** — access + refresh tokens for authenticated sessions; short-lived access tokens.
- **RBAC** — `admins.role` gates which actions an admin can perform (approve loans, view reports, manage users).
- **SQL injection prevention** — parameterized queries / ORM only, no string-concatenated SQL.
- **Audit logging** — every write to a financial table is logged in `audit_logs`.
- **Soft delete** — `deleted_at` columns instead of hard deletes on `users`, `loans`, `payments` (BR-009).
- **HTTPS** — all API traffic encrypted in transit.

---

## 14. Naming Conventions

| Object | Convention | Example |
|--------|------------|---------|
| Tables | snake_case, plural | `loan_installments` |
| Columns | snake_case | `remaining_balance` |
| Primary keys | `id` | `id` |
| Foreign keys | `<table_singular>_id` | `loan_id`, `user_id` |
| Stored procedures | `sp_` prefix | `sp_approve_application` |
| Triggers | `trg_` prefix | `trg_after_payment_insert` |
| Views | `vw_` prefix | `vw_dashboard` |
| Indexes | `idx_` prefix | `idx_loans_status` |

---

## 15. Backup & Recovery

- **Daily** — automated full backup, retained 7 days.
- **Weekly** — full backup, retained 4 weeks.
- **Monthly** — full backup, retained 12 months (compliance/audit needs for financial data).
- **Restore drill** — test restore procedure quarterly to confirm backups are valid.
- **Point-in-time recovery** — enable binary/transaction logs so the DB can be restored to any point between backups.

---

## 16. API → Database Mapping

| Endpoint | Tables affected |
|----------|------------------|
| `POST /auth/register` | INSERT `users` |
| `POST /auth/login` | SELECT `users` |
| `POST /loan/apply` | INSERT `loan_applications` |
| `POST /admin/loan/approve` | UPDATE `loan_applications`; INSERT `loans`, `loan_installments`, `loan_transactions`, `audit_logs` |
| `POST /admin/loan/reject` | UPDATE `loan_applications`; INSERT `audit_logs` |
| `GET /loan/emi-schedule` | SELECT `loan_installments` |
| `POST /payments` | INSERT `payments`; UPDATE `loan_installments`, `loans`; INSERT `loan_transactions`, `audit_logs` |
| `GET /reports/collections` | SELECT `vw_monthly_collection` |
| `GET /dashboard` | SELECT `vw_dashboard` |

---

## 17. Module Build Order

Recommended implementation sequence to minimize integration issues:

```
1. Authentication (users, admins)
2. Customer Management
3. Loan Types (master data)
4. Loan Application
5. Loan Approval → Loan Creation
6. EMI Generation
7. Payments
8. Reports & Dashboard
9. Audit Logs (wire in throughout, not bolted on at the end)
```

---

## 18. Future Scalability

Planned extensions once the core flow is stable:

```
Branch Management
Employee Management
Penalty / Late-fee calculation
SMS & Email notifications
Expense & Accounting module
Multi-branch support
Multi-currency support
Online payment gateway integration
```

---

*This document should be kept in sync with the actual schema — update it in the same PR whenever a table, column, or business rule changes.*
