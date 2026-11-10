# Microfinance Loan Management System

# Complete Route Documentation

## Overview

The application is divided into two layers:

1. **UI & Gateway Routes**

   * Render EJS views.
   * Handle authentication.
   * Proxy requests to backend microservices.

2. **REST API Routes**

   * Business logic.
   * Database operations.
   * JSON responses.
   * Used by the Gateway.

---

# 1. UI & Gateway Routes (`app.js`)

These routes render HTML pages and communicate with backend services.

## Authentication

| Method | Route                   | Description          |
| ------ | ----------------------- | -------------------- |
| GET    | `/`                     | Landing Page         |
| GET    | `/auth/login`           | Login Page           |
| POST   | `/auth/login`           | User Login           |
| GET    | `/auth/register`        | Registration Page    |
| POST   | `/auth/register`        | Register New User    |
| GET    | `/auth/logout`          | Logout               |
| GET    | `/auth/change-password` | Change Password Page |
| POST   | `/auth/change-password` | Update Password      |

---

## Customer Portal

| Method | Route                                        | Description                 |
| ------ | -------------------------------------------- | --------------------------- |
| GET    | `/customer/dashboard`                        | Customer Dashboard          |
| GET    | `/customer/profile`                          | Customer Profile            |
| GET    | `/customer/loans`                            | Customer Loan List          |
| GET    | `/customer/loans/:loanId`                    | Loan Details & EMI Schedule |
| GET    | `/customer/payments`                         | Payment History             |
| GET    | `/customer/payments/checkout/:installmentId` | Mock Payment Checkout       |
| POST   | `/customer/payments/process`                 | Process Mock Payment        |
| POST   | `/customer/payments/webhook`                 | Payment Callback            |
| GET    | `/customer/apply`                            | Loan Application Form       |
| GET    | `/customer/status`                           | Application Status          |
| GET    | `/customer/support`                          | Help & Support              |

---

## Admin Portal

| Method | Route                     | Description                |
| ------ | ------------------------- | -------------------------- |
| GET    | `/admin/dashboard`        | Admin Dashboard            |
| GET    | `/admin/applications/:id` | Loan Application Details   |
| GET    | `/admin/disbursements`    | Pending Loan Disbursements |
| GET    | `/admin/loans`            | Loan Management            |
| GET    | `/admin/repayments`       | Customer Repayments        |
| GET    | `/admin/reports`          | Reports Dashboard          |
| GET    | `/admin/settings`         | System Settings            |
| POST   | `/admin/settings`         | Update System Settings     |

---

# 2. REST API Routes

All API routes are mounted under:

```text
/api
```

Example:

```text
/api/auth/login
```

---

# Authentication API

**File**

```text
routes/authRoutes.js
```

| Method | Endpoint              | Description       |
| ------ | --------------------- | ----------------- |
| POST   | `/auth/login`         | Authenticate User |
| POST   | `/auth/register`      | Register User     |
| POST   | `/auth/logout`        | Logout            |
| GET    | `/auth/logout`        | Logout Session    |
| POST   | `/auth/refresh-token` | Refresh JWT Token |

---

# User Management API

**File**

```text
routes/userRoutes.js
```

| Method | Endpoint                | Description  |
| ------ | ----------------------- | ------------ |
| GET    | `/users`                | List Users   |
| GET    | `/users/id/:id`         | User by ID   |
| GET    | `/users/code/:userCode` | User by Code |

---

# Customer Management API

**File**

```text
routes/customerRoutes.js
```

| Method | Endpoint         | Description      |
| ------ | ---------------- | ---------------- |
| GET    | `/customers`     | List Customers   |
| POST   | `/customers`     | Create Customer  |
| GET    | `/customers/:id` | Customer Details |
| PUT    | `/customers/:id` | Update Customer  |
| DELETE | `/customers/:id` | Delete Customer  |

---

# Loan Application API

**File**

```text
routes/loanApplicationRoutes.js
```

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/applications`             | List Loan Applications  |
| POST   | `/applications`             | Submit Loan Application |
| GET    | `/applications/:id`         | Application Details     |
| POST   | `/applications/:id/approve` | Approve Application     |
| POST   | `/applications/:id/reject`  | Reject Application      |

---

# Loan Management API

**File**

```text
routes/loanRoutes.js
```

| Method | Endpoint                      | Description           |
| ------ | ----------------------------- | --------------------- |
| GET    | `/loans`                      | List Loans            |
| GET    | `/loans/:id`                  | Loan Details          |
| POST   | `/loans/:id/close`            | Close Loan            |
| GET    | `/loans/customer/:customerId` | Customer Loan History |

---

# Payment API

**File**

```text
routes/paymentRoutes.js
```

| Method | Endpoint                         | Description          |
| ------ | -------------------------------- | -------------------- |
| GET    | `/payments`                      | List Payments        |
| POST   | `/payments`                      | Record Payment       |
| GET    | `/payments/:id`                  | Payment Details      |
| GET    | `/payments/customer/:customerId` | Customer Payments    |
| GET    | `/payments/loan/:loanId`         | Loan Payment History |

---

# Dashboard API

**File**

```text
routes/dashboardRoutes.js
```

| Method | Endpoint                       | Description           |
| ------ | ------------------------------ | --------------------- |
| GET    | `/dashboard/summary`           | Dashboard KPIs        |
| GET    | `/dashboard/recent-loans`      | Recent Loans          |
| GET    | `/dashboard/upcoming-payments` | Upcoming EMI Payments |

---

# Reporting API

**File**

```text
routes/reportRoutes.js
```

| Method | Endpoint                                | Description                      |
| ------ | --------------------------------------- | -------------------------------- |
| GET    | `/reports/dashboard`                    | Dashboard Reports                |
| GET    | `/reports/admin-reports`                | Administrative Reports           |
| GET    | `/reports/collection`                   | Collection Report                |
| GET    | `/reports/overdue-loans`                | Overdue Loan Report              |
| GET    | `/reports/customer-summary/:customerId` | Customer Financial Summary       |
| GET    | `/reports/monthly/:year/:month`         | Monthly Report                   |
| GET    | `/reports/export/csv/collections`       | Export Monthly Collections (CSV) |
| GET    | `/reports/export/csv/overdue`           | Export Overdue Loans (CSV)       |

---

# System Architecture

```text
                    Browser
                       │
                       ▼
             UI & Gateway (app.js)
                       │
      ┌────────────────┼────────────────┐
      │                │                │
      ▼                ▼                ▼
 Authentication   Customer UI     Admin UI
      │                │                │
      └────────────────┼────────────────┘
                       │
                  REST APIs (/api)
                       │
      ┌──────────┬──────────┬──────────┬──────────┐
      ▼          ▼          ▼          ▼
    Auth      Customer     Loan     Payments
      │          │          │          │
      └──────────┼──────────┼──────────┘
                 ▼
          Reports & Dashboard
                 │
                 ▼
         MySQL Database Layer
     (Views, Procedures, Tables)
```

# Route Summary

| Category                  |        Routes |
| ------------------------- | ------------: |
| Authentication (UI + API) |             9 |
| Customer Portal           |            10 |
| Admin Portal              |             7 |
| User Management API       |             3 |
| Customer Management API   |             5 |
| Loan Application API      |             5 |
| Loan Management API       |             4 |
| Payment API               |             5 |
| Dashboard API             |             3 |
| Reporting API             |             8 |
| **Total**                 | **59 Routes** |
