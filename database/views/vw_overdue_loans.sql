CREATE OR REPLACE VIEW vw_overdue_loans AS
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
