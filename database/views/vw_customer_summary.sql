CREATE OR REPLACE VIEW vw_customer_summary AS
SELECT 
  c.user_id AS customer_id,
  COUNT(l.id) AS total_loans,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_loans,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN l.outstanding_balance ELSE 0 END) AS total_outstanding_balance,
  SUM(CASE WHEN l.loan_status = 'ACTIVE' THEN l.principal_amount ELSE 0 END) AS active_loan_amount
FROM customer_profiles c
LEFT JOIN loans l ON c.id = l.customer_id
GROUP BY c.user_id;
