CREATE OR REPLACE VIEW vw_dashboard AS
SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER')
    AS total_customers,

  (SELECT COUNT(*) FROM loans WHERE loan_status = 'ACTIVE')
    AS active_loans,

  (SELECT COALESCE(SUM(principal_amount), 0) FROM loans)
    AS total_money_lent,

  (SELECT COUNT(*) FROM loan_applications WHERE application_status = 'APPROVED')
    AS approved_loans,

  (SELECT COALESCE(SUM(payment_amount), 0) FROM payments
   WHERE DATE(payment_date) = CURDATE())
    AS todays_collections,

  (SELECT COALESCE(SUM(outstanding_balance), 0) FROM loans
   WHERE loan_status = 'ACTIVE')
    AS outstanding_balance,

  (SELECT COALESCE(SUM(remaining_amount), 0) FROM loan_installments
   WHERE installment_status = 'OVERDUE')
    AS overdue_amount,

  (SELECT COUNT(*) FROM loans WHERE loan_status = 'CLOSED')
    AS closed_loans,

  (SELECT COALESCE(SUM(payment_amount), 0) FROM payments
   WHERE payment_status = 'SUCCESS')
    AS total_repayments_received;
