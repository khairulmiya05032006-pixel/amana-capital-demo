DELIMITER $$
DROP EVENT IF EXISTS evt_mark_overdue_installments$$

CREATE EVENT evt_mark_overdue_installments
ON SCHEDULE EVERY 1 DAY STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 1 MINUTE)
DO
BEGIN
  -- We add a 2% penalty to the total_amount when an installment goes overdue.
  -- This runs daily at 00:01 AM.

  UPDATE loan_installments
  SET 
    penalty_amount = penalty_amount + (total_amount * 0.02),
    installment_status = 'OVERDUE'
  WHERE 
    installment_status = 'PENDING' 
    AND due_date < CURRENT_DATE();

END$$
DELIMITER ;
