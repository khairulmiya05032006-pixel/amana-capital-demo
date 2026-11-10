DELIMITER $$
DROP PROCEDURE IF EXISTS sp_close_loan$$
CREATE PROCEDURE sp_close_loan(
  IN p_loan_id BIGINT,
  IN p_admin_id BIGINT
)
BEGIN
  -- Exit if exception occurs
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

    UPDATE loans 
    SET loan_status = 'CLOSED', closed_at = NOW() 
    WHERE id = p_loan_id AND loan_status != 'CLOSED';

    IF ROW_COUNT() > 0 THEN
      INSERT INTO loan_status_history(loan_id, old_status, new_status, changed_by)
      VALUES(p_loan_id, 'ACTIVE', 'CLOSED', p_admin_id);

      -- Write Audit Log
      -- The triggers will handle this if we rely on trg_audit_log for updates,
      -- but an explicit SP log is nice too.
    END IF;

  COMMIT;
END$$
DELIMITER ;
