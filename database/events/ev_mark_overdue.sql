DELIMITER $$
DROP EVENT IF EXISTS evt_mark_overdue_installments$$

CREATE EVENT evt_mark_overdue_installments
ON SCHEDULE EVERY 1 DAY STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 1 MINUTE)
DO
BEGIN
  DECLARE v_penalty_rate DECIMAL(5,2);

  -- Read penalty rate from system_settings
  SELECT CAST(setting_value AS DECIMAL(5,2)) INTO v_penalty_rate
  FROM system_settings
  WHERE setting_key = 'penalty_rate';

  IF v_penalty_rate IS NULL THEN
      SET v_penalty_rate = 2.00;
  END IF;

  UPDATE loan_installments
  SET 
    penalty_amount = penalty_amount + (total_amount * (v_penalty_rate / 100)),
    installment_status = 'OVERDUE'
  WHERE 
    installment_status = 'PENDING' 
    AND due_date < CURRENT_DATE();

END$$
DELIMITER ;
