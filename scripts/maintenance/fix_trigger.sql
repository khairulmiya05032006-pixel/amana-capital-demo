USE defaultdb;
DELIMITER $$
DROP TRIGGER IF EXISTS trg_audit_log_applications$$
CREATE TRIGGER trg_audit_log_applications
AFTER UPDATE ON loan_applications
FOR EACH ROW
BEGIN
  IF OLD.application_status != NEW.application_status THEN
    INSERT INTO audit_logs(user_id, module_name, entity_name, entity_id, action, description, created_at)
    VALUES(
      IFNULL(NEW.reviewed_by, 1), 
      'LoanApplication', 
      'loan_applications', 
      NEW.id, 
      IF(NEW.application_status = 'APPROVED', 'APPROVE', IF(NEW.application_status = 'REJECTED', 'REJECT', 'UPDATE')), 
      CONCAT('Status changed from ', OLD.application_status, ' to ', NEW.application_status), 
      NOW()
    );
  END IF;
END$$
DELIMITER ;
