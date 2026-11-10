DELIMITER $$
DROP PROCEDURE IF EXISTS sp_record_payment$$
CREATE PROCEDURE sp_record_payment(
  IN p_loan_id BIGINT, 
  IN p_installment_id BIGINT, 
  IN p_customer_id BIGINT,
  IN p_amount DECIMAL(15,2), 
  IN p_method VARCHAR(20),
  IN p_reference VARCHAR(50),
  IN p_collected_by BIGINT
)
BEGIN
  DECLARE v_txn_num VARCHAR(30);
  DECLARE v_pay_num VARCHAR(30);
  DECLARE v_principal DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_interest DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_penalty DECIMAL(15,2) DEFAULT 0.00;

  -- Exit if exception occurs
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

    -- Basic split for recording purposes (In a real system, you'd calculate exact proportions based on the installment breakdown)
    -- For this simplified model, we assume the amount pays off any penalty first, then interest, then principal.
    -- (We will just record the whole amount to principal_paid for simplicity unless penalty > 0).
    
    SET v_pay_num = CONCAT('PAY', DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s%f'), p_loan_id);
    
    INSERT INTO payments(payment_number, loan_id, installment_id, customer_id, payment_date, payment_amount, principal_paid, interest_paid, penalty_paid, payment_method, transaction_reference, collected_by)
    VALUES(v_pay_num, p_loan_id, p_installment_id, p_customer_id, NOW(), p_amount, p_amount, 0, 0, p_method, p_reference, p_collected_by);

    -- Update the installment
    UPDATE loan_installments
    SET paid_amount = paid_amount + p_amount,
        installment_status = CASE WHEN paid_amount + p_amount >= (total_amount + penalty_amount) THEN 'PAID' ELSE installment_status END
    WHERE id = p_installment_id AND loan_id = p_loan_id;

    -- Update loan balances
    UPDATE loans
    SET outstanding_balance = outstanding_balance - p_amount
    WHERE id = p_loan_id;

    -- Record Transaction
    SET v_txn_num = CONCAT('TXN', DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s%f'), p_loan_id);
    INSERT INTO loan_transactions(transaction_number, loan_id, customer_id, transaction_type, credit_amount, running_balance, created_by)
    VALUES(v_txn_num, p_loan_id, p_customer_id, 'PAYMENT', p_amount, (SELECT outstanding_balance FROM loans WHERE id = p_loan_id), p_collected_by);

    -- Check if closed
    IF (SELECT outstanding_balance FROM loans WHERE id = p_loan_id) <= 0 THEN
      CALL sp_close_loan(p_loan_id, p_collected_by);
    END IF;

  COMMIT;
END$$
DELIMITER ;
