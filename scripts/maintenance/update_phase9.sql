USE defaultdb;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_by    BIGINT UNSIGNED,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('penalty_rate', '2.00')
ON DUPLICATE KEY UPDATE setting_value=setting_value;

DELIMITER //

ALTER EVENT evt_mark_overdue_installments
DO
BEGIN
    DECLARE v_penalty_rate DECIMAL(5,2);
    
    -- Read penalty rate from system_settings
    SELECT CAST(setting_value AS DECIMAL(5,2)) INTO v_penalty_rate
    FROM system_settings
    WHERE setting_key = 'penalty_rate';
    
    -- Default to 2.00 if missing
    IF v_penalty_rate IS NULL THEN
        SET v_penalty_rate = 2.00;
    END IF;

    UPDATE loan_installments li
    JOIN loans l ON li.loan_id = l.id
    SET 
        li.installment_status = 'OVERDUE',
        li.penalty_amount = ROUND(li.remaining_amount * (v_penalty_rate / 100), 2),
        li.total_amount = li.total_amount + ROUND(li.remaining_amount * (v_penalty_rate / 100), 2),
        li.remaining_amount = li.remaining_amount + ROUND(li.remaining_amount * (v_penalty_rate / 100), 2),
        l.outstanding_balance = l.outstanding_balance + ROUND(li.remaining_amount * (v_penalty_rate / 100), 2),
        li.updated_at = CURRENT_TIMESTAMP
    WHERE 
        li.installment_status IN ('PENDING', 'PARTIALLY_PAID') 
        AND li.due_date < CURRENT_DATE();
END //

DELIMITER ;
