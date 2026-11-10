DELIMITER $$
DROP TRIGGER IF EXISTS trg_update_outstanding$$
CREATE TRIGGER trg_update_outstanding
BEFORE UPDATE ON loans
FOR EACH ROW
BEGIN
  -- Prevent manual arbitrary updates to outstanding_balance unless it matches the logic.
  -- This is a soft guard. In a real system, we'd ensure updates only come from sp_record_payment.
  -- A common way to enforce this is to verify the NEW.outstanding_balance is not greater than the original loan unless a specific flag is set.
  IF NEW.outstanding_balance > OLD.outstanding_balance AND NEW.loan_status = OLD.loan_status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Direct modification of outstanding_balance is not permitted';
  END IF;
END$$
DELIMITER ;
