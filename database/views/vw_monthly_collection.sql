CREATE OR REPLACE VIEW vw_monthly_collection AS
SELECT 
  DATE_FORMAT(payment_date, '%Y-%m') AS collection_month,
  SUM(payment_amount) AS total_collected,
  COUNT(id) AS number_of_payments
FROM payments
GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
ORDER BY collection_month DESC;
