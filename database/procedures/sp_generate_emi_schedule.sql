

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_generate_emi_schedule$$
CREATE PROCEDURE sp_generate_emi_schedule(IN p_loan_id BIGINT)
BEGIN
    DECLARE v_tenure INT;
    DECLARE v_emi DECIMAL(15,2);
    DECLARE v_principal_total DECIMAL(15,2);
    DECLARE v_interest_total DECIMAL(15,2);
    DECLARE v_first_date DATE;
    
    DECLARE v_prin_per_month DECIMAL(15,2);
    DECLARE v_int_per_month DECIMAL(15,2);
    
    DECLARE v_opening DECIMAL(15,2);
    
    DECLARE i INT DEFAULT 1;

    SELECT tenure_months, emi_amount, principal_amount, total_interest, first_installment_date 
    INTO v_tenure, v_emi, v_principal_total, v_interest_total, v_first_date
    FROM loans WHERE id = p_loan_id;

    SET v_prin_per_month = v_principal_total / v_tenure;
    SET v_int_per_month = v_interest_total / v_tenure;
    SET v_opening = v_principal_total + v_interest_total;

    WHILE i <= v_tenure DO
        INSERT INTO loan_installments (
            loan_id, installment_number, due_date, 
            opening_balance, principal_amount, interest_amount, 
            penalty_amount, total_amount, paid_amount, 
            remaining_amount, closing_balance, installment_status
        )
        VALUES (
            p_loan_id, i, DATE_ADD(v_first_date, INTERVAL (i-1) MONTH), 
            v_opening, v_prin_per_month, v_int_per_month, 
            0.00, v_emi, 0.00, 
            v_emi, v_opening - v_emi, 'PENDING'
        );
        
        SET v_opening = v_opening - v_emi;
        SET i = i + 1;
    END WHILE;
END$$
DELIMITER ;
