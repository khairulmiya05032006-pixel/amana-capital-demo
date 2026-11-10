# Business Rules and Validation

## User Management

- Email must be unique and valid format
- User codes must be unique
- Passwords must be at least 8 characters with uppercase, lowercase, and numbers
- Account can be ACTIVE, INACTIVE, or BLOCKED
- Last login is updated on successful authentication

## Customer Management

- Each customer must have unique email and phone
- Customer can only borrow if account status is ACTIVE
- Multiple loans allowed per customer
- Customer code is auto-generated and unique

## Loan Application Rules

- Application status flow: PENDING → UNDER_REVIEW → APPROVED/REJECTED
- Only customers with ACTIVE status can apply
- Application amount must be positive
- Requested duration must be between 3-60 months
- Monthly income must be greater than requested loan EMI

## Loan Rules

- EMI is calculated using standard amortization formula
- Interest rate must be non-negative
- Tenure must be between 3-60 months
- Loan status flow: ACTIVE → COMPLETED/DEFAULTED/WRITTEN_OFF/CLOSED
- Outstanding balance decreases with each payment
- Cannot close a loan with outstanding balance

## Payment Rules

- Payment amount must match installment or full loan balance
- Payment can only be made for ACTIVE loans
- Payment date must be current or past due date
- Multiple partial payments allowed
- Payment status: PENDING, COMPLETED, FAILED

## Installment Rules

- EMI amount is fixed throughout the tenure
- Principal portion increases and interest decreases over time
- Installment status: SCHEDULED, PAID, OVERDUE, PARTIALLY_PAID
- Overdue status when due date has passed and not fully paid

## EMI Calculation Formula

```
EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)

Where:
P = Principal amount
r = Monthly interest rate (Annual rate / 12 / 100)
n = Number of months
```

## Audit Logging

- All INSERT, UPDATE, DELETE operations logged
- User ID and timestamp captured for each change
- Old and new values stored for UPDATE operations
- Supports compliance and audit trail requirements

