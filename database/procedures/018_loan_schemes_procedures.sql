

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. sp_generate_payment_schedule
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_generate_payment_schedule$$

CREATE PROCEDURE sp_generate_payment_schedule(
    IN p_loan_id BIGINT UNSIGNED, 
    IN p_scheme_id BIGINT UNSIGNED
)
BEGIN
    DECLARE v_principal DECIMAL(15,2);
    DECLARE v_scheme_freq ENUM('DAILY', 'WEEKLY', 'MONTHLY');
    DECLARE v_interest_type ENUM('FLAT', 'REDUCING_BALANCE');
    DECLARE v_annual_rate DECIMAL(7,4);
    DECLARE v_dur_val INT;
    DECLARE v_dur_unit ENUM('DAYS', 'WEEKS', 'MONTHS');
    DECLARE v_total_days INT;
    DECLARE v_tenure INT;
    DECLARE v_periodic_rate DECIMAL(15,8);
    
    DECLARE v_emi DECIMAL(15,2);
    DECLARE v_total_flat_interest DECIMAL(15,2);
    
    DECLARE v_remaining_principal DECIMAL(15,2);
    DECLARE v_loop_idx INT DEFAULT 1;
    DECLARE v_due_date DATE;
    
    DECLARE v_inst_interest DECIMAL(15,2);
    DECLARE v_inst_principal DECIMAL(15,2);
    
    -- 1. Fetch loan and scheme details
    SELECT principal_amount, disbursement_date INTO v_principal, v_due_date
    FROM loans WHERE id = p_loan_id;
    
    SELECT repayment_frequency, interest_type, base_interest_rate, duration_value, duration_unit
    INTO v_scheme_freq, v_interest_type, v_annual_rate, v_dur_val, v_dur_unit
    FROM loan_schemes WHERE id = p_scheme_id;
    
    -- 2. Convert duration to Total Days and Tenure
    IF v_dur_unit = 'DAYS' THEN
        SET v_total_days = v_dur_val;
    ELSEIF v_dur_unit = 'WEEKS' THEN
        SET v_total_days = v_dur_val * 7;
    ELSE
        SET v_total_days = v_dur_val * 30; -- standard 30/360 approximation
    END IF;
    
    IF v_scheme_freq = 'DAILY' THEN
        SET v_tenure = v_total_days;
        SET v_periodic_rate = (v_annual_rate / 100) / 365;
    ELSEIF v_scheme_freq = 'WEEKLY' THEN
        SET v_tenure = FLOOR(v_total_days / 7);
        SET v_periodic_rate = (v_annual_rate / 100) / 52;
    ELSE
        SET v_tenure = FLOOR(v_total_days / 30);
        SET v_periodic_rate = (v_annual_rate / 100) / 12;
    END IF;
    
    IF v_tenure < 1 THEN
        SET v_tenure = 1;
    END IF;
    
    -- 3. Upfront Calculations
    IF v_interest_type = 'REDUCING_BALANCE' THEN
        IF v_periodic_rate > 0 THEN
            SET v_emi = ROUND( v_principal * v_periodic_rate * POW(1 + v_periodic_rate, v_tenure) / (POW(1 + v_periodic_rate, v_tenure) - 1), 2 );
        ELSE
            SET v_emi = ROUND( v_principal / v_tenure, 2 );
        END IF;
    ELSE -- FLAT
        SET v_total_flat_interest = ROUND( v_principal * (v_annual_rate / 100) * (v_total_days / 365), 2 );
    END IF;
    
    -- 4. Initialization
    SET v_remaining_principal = v_principal;
    
    -- 5. Loop and Generate
    generate_loop: LOOP
        IF v_loop_idx > v_tenure THEN
            LEAVE generate_loop;
        END IF;
        
        -- Calculate components
        IF v_interest_type = 'REDUCING_BALANCE' THEN
            SET v_inst_interest = ROUND(v_remaining_principal * v_periodic_rate, 2);
            SET v_inst_principal = v_emi - v_inst_interest;
        ELSE -- FLAT
            SET v_inst_interest = ROUND(v_total_flat_interest / v_tenure, 2);
            SET v_inst_principal = ROUND(v_principal / v_tenure, 2);
            SET v_emi = v_inst_principal + v_inst_interest;
        END IF;
        
        -- Final Installment Adjustments (Absorb Rounding)
        IF v_loop_idx = v_tenure THEN
            SET v_inst_principal = v_remaining_principal;
            SET v_emi = v_inst_principal + v_inst_interest;
        END IF;
        
        -- Advance Date
        IF v_scheme_freq = 'DAILY' THEN
            SET v_due_date = DATE_ADD(v_due_date, INTERVAL 1 DAY);
        ELSEIF v_scheme_freq = 'WEEKLY' THEN
            SET v_due_date = DATE_ADD(v_due_date, INTERVAL 7 DAY);
        ELSE
            SET v_due_date = DATE_ADD(v_due_date, INTERVAL 1 MONTH);
        END IF;
        
        -- Insert Schedule
        INSERT INTO payment_schedules (
            loan_id, installment_number, due_date, principal_amount, 
            interest_amount, penalty_amount, total_due, paid_amount, 
            remaining_amount, status
        ) VALUES (
            p_loan_id, v_loop_idx, v_due_date, v_inst_principal, 
            v_inst_interest, 0, v_emi, 0, 
            v_emi, 'PENDING'
        );
        
        SET v_remaining_principal = v_remaining_principal - v_inst_principal;
        SET v_loop_idx = v_loop_idx + 1;
    END LOOP generate_loop;
    
    -- 6. Audit Log
    INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, new_values)
    VALUES (1, 'Loans', 'loans', p_loan_id, 'LOAN_SCHEDULE_GENERATED', JSON_OBJECT('scheme_id', p_scheme_id, 'tenure', v_tenure));
    
END$$


-- -----------------------------------------------------------------------------
-- 2. sp_close_loan_v2
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_close_loan_v2$$

CREATE PROCEDURE sp_close_loan_v2(IN p_loan_id BIGINT UNSIGNED)
BEGIN
    UPDATE loans 
    SET loan_status = 'CLOSED', closed_at = NOW() 
    WHERE id = p_loan_id AND loan_status != 'CLOSED';
    
    IF ROW_COUNT() > 0 THEN
        INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action)
        VALUES (1, 'Loans', 'loans', p_loan_id, 'LOAN_CLOSED');
    END IF;
END$$


-- -----------------------------------------------------------------------------
-- 3. sp_record_payment_v2
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_record_payment_v2$$

CREATE PROCEDURE sp_record_payment_v2(
    IN p_loan_id BIGINT UNSIGNED, 
    IN p_payment_amount DECIMAL(15,2), 
    IN p_reference_number VARCHAR(100),
    IN p_customer_id BIGINT UNSIGNED
)
BEGIN
    DECLARE v_remaining_payment DECIMAL(15,2) DEFAULT p_payment_amount;
    DECLARE v_schedule_id BIGINT UNSIGNED;
    DECLARE v_prin_unpaid DECIMAL(15,2);
    DECLARE v_int_unpaid DECIMAL(15,2);
    DECLARE v_pen_unpaid DECIMAL(15,2);
    
    DECLARE v_pay_pen DECIMAL(15,2);
    DECLARE v_pay_int DECIMAL(15,2);
    DECLARE v_pay_prin DECIMAL(15,2);
    DECLARE v_total_applied_to_schedule DECIMAL(15,2);
    
    DECLARE done INT DEFAULT FALSE;
    
    -- Cursor for unpaid schedules ordered by due date
    DECLARE cur_schedules CURSOR FOR 
        SELECT id, 
               (principal_amount - (SELECT COALESCE(SUM(credit_amount),0) FROM loan_transactions WHERE installment_id = ps.id AND transaction_type = 'PAYMENT' AND description = 'Principal')),
               (interest_amount - (SELECT COALESCE(SUM(credit_amount),0) FROM loan_transactions WHERE installment_id = ps.id AND transaction_type = 'PAYMENT' AND description = 'Interest')),
               (penalty_amount - (SELECT COALESCE(SUM(credit_amount),0) FROM loan_transactions WHERE installment_id = ps.id AND transaction_type = 'PAYMENT' AND description = 'Penalty'))
        FROM payment_schedules ps
        WHERE loan_id = p_loan_id AND status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
        ORDER BY due_date ASC;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- 1. Start Transaction
    START TRANSACTION;
    
    -- Ensure the unique constraint protects us from duplicate references implicitly.
    -- (This will fail loudly if p_reference_number is duplicated, meeting our idempotency requirement).
    
    -- 2. Lock rows
    SELECT id INTO @dummy FROM loans WHERE id = p_loan_id FOR UPDATE;
    SELECT id INTO @dummy2 FROM payment_schedules WHERE loan_id = p_loan_id AND status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE') FOR UPDATE;
    SELECT id INTO @dummy3 FROM penalties WHERE loan_id = p_loan_id AND status IN ('UNPAID', 'PARTIALLY_PAID') FOR UPDATE;
    
    OPEN cur_schedules;
    
    schedule_loop: LOOP
        FETCH cur_schedules INTO v_schedule_id, v_prin_unpaid, v_int_unpaid, v_pen_unpaid;
        
        IF done OR v_remaining_payment <= 0 THEN
            LEAVE schedule_loop;
        END IF;
        
        -- Protect against negative unpaid amounts just in case
        IF v_pen_unpaid < 0 THEN SET v_pen_unpaid = 0; END IF;
        IF v_int_unpaid < 0 THEN SET v_int_unpaid = 0; END IF;
        IF v_prin_unpaid < 0 THEN SET v_prin_unpaid = 0; END IF;
        
        SET v_pay_pen = 0;
        SET v_pay_int = 0;
        SET v_pay_prin = 0;
        
        -- 3.1 Pay Penalty
        IF v_pen_unpaid > 0 AND v_remaining_payment > 0 THEN
            SET v_pay_pen = LEAST(v_pen_unpaid, v_remaining_payment);
            SET v_remaining_payment = v_remaining_payment - v_pay_pen;
            
            INSERT INTO loan_transactions (transaction_number, loan_id, installment_id, customer_id, transaction_type, credit_amount, running_balance, reference_number, description, created_by)
            VALUES (CONCAT('PAY-PEN-', UNIX_TIMESTAMP(), '-', v_schedule_id), p_loan_id, v_schedule_id, p_customer_id, 'PAYMENT', v_pay_pen, 0, p_reference_number, 'Penalty', 1);
            
            UPDATE penalties SET paid_amount = paid_amount + v_pay_pen, status = IF(penalty_amount <= paid_amount + v_pay_pen, 'PAID', 'PARTIALLY_PAID') WHERE schedule_id = v_schedule_id;
        END IF;
        
        -- 3.2 Pay Interest
        IF v_int_unpaid > 0 AND v_remaining_payment > 0 THEN
            SET v_pay_int = LEAST(v_int_unpaid, v_remaining_payment);
            SET v_remaining_payment = v_remaining_payment - v_pay_int;
            
            INSERT INTO loan_transactions (transaction_number, loan_id, installment_id, customer_id, transaction_type, credit_amount, running_balance, reference_number, description, created_by)
            VALUES (CONCAT('PAY-INT-', UNIX_TIMESTAMP(), '-', v_schedule_id), p_loan_id, v_schedule_id, p_customer_id, 'PAYMENT', v_pay_int, 0, p_reference_number, 'Interest', 1);
        END IF;
        
        -- 3.3 Pay Principal
        IF v_prin_unpaid > 0 AND v_remaining_payment > 0 THEN
            SET v_pay_prin = LEAST(v_prin_unpaid, v_remaining_payment);
            SET v_remaining_payment = v_remaining_payment - v_pay_prin;
            
            INSERT INTO loan_transactions (transaction_number, loan_id, installment_id, customer_id, transaction_type, credit_amount, running_balance, reference_number, description, created_by)
            VALUES (CONCAT('PAY-PRN-', UNIX_TIMESTAMP(), '-', v_schedule_id), p_loan_id, v_schedule_id, p_customer_id, 'PAYMENT', v_pay_prin, 0, p_reference_number, 'Principal', 1);
            
            -- Update loan outstanding balance
            UPDATE loans SET outstanding_balance = outstanding_balance - v_pay_prin WHERE id = p_loan_id;
        END IF;
        
        -- Update Schedule Row Status
        SET v_total_applied_to_schedule = v_pay_pen + v_pay_int + v_pay_prin;
        IF v_total_applied_to_schedule > 0 THEN
            UPDATE payment_schedules 
            SET paid_amount = paid_amount + v_total_applied_to_schedule,
                remaining_amount = total_due - (paid_amount + v_total_applied_to_schedule),
                status = IF(total_due <= paid_amount + v_total_applied_to_schedule, 'PAID', 'PARTIALLY_PAID')
            WHERE id = v_schedule_id;
        END IF;
        
    END LOOP schedule_loop;
    
    CLOSE cur_schedules;
    
    -- 4. Overpayment / Foreclosure
    IF v_remaining_payment > 0 THEN
        -- Apply to principal reduction directly on the loan
        UPDATE loans SET outstanding_balance = GREATEST(0, outstanding_balance - v_remaining_payment) WHERE id = p_loan_id;
        
        INSERT INTO loan_transactions (transaction_number, loan_id, customer_id, transaction_type, credit_amount, running_balance, reference_number, description, created_by)
        VALUES (CONCAT('PAY-OVR-', UNIX_TIMESTAMP(), '-', p_loan_id), p_loan_id, p_customer_id, 'PAYMENT', v_remaining_payment, 0, p_reference_number, 'Overpayment / Foreclosure Principal Reduction', 1);
        
        -- Update the last schedule just to reflect it was overpaid if needed, or leave it as it is.
    END IF;
    
    -- 5. Finalize
    INSERT INTO payments (payment_number, loan_id, customer_id, amount, payment_date, payment_method, reference_number, processed_by)
    VALUES (CONCAT('REC-', UNIX_TIMESTAMP(), '-', p_loan_id), p_loan_id, p_customer_id, p_payment_amount, CURDATE(), 'SYSTEM', p_reference_number, 1);
    
    -- Check if loan is fully paid off
    IF (SELECT outstanding_balance FROM loans WHERE id = p_loan_id) <= 0 THEN
        CALL sp_close_loan_v2(p_loan_id);
    END IF;
    
    COMMIT;
END$$


-- -----------------------------------------------------------------------------
-- 4. ev_mark_overdue_v2
-- -----------------------------------------------------------------------------
DROP EVENT IF EXISTS ev_mark_overdue_v2$$

CREATE EVENT ev_mark_overdue_v2
ON SCHEDULE EVERY 1 DAY STARTS '2026-08-09 02:00:00'
DO
BEGIN
    -- Update status
    UPDATE payment_schedules ps
    JOIN loans l ON ps.loan_id = l.id
    JOIN customer_scheme_subscriptions css ON l.id = css.loan_id
    JOIN loan_schemes ls ON css.scheme_id = ls.id
    SET ps.status = 'OVERDUE'
    WHERE ps.status IN ('PENDING', 'PARTIALLY_PAID')
      AND CURDATE() > DATE_ADD(ps.due_date, INTERVAL ls.grace_period_days DAY);

    -- Insert penalties safely
    INSERT INTO penalties (loan_id, schedule_id, penalty_amount)
    SELECT ps.loan_id, ps.id, 
      IF(ls.penalty_type = 'FIXED', ls.penalty_value, ROUND( (ps.total_due - ps.paid_amount) * (ls.penalty_value / 100), 2 ))
    FROM payment_schedules ps
    JOIN customer_scheme_subscriptions css ON ps.loan_id = css.loan_id
    JOIN loan_schemes ls ON css.scheme_id = ls.id
    WHERE ps.status = 'OVERDUE'
    ON DUPLICATE KEY UPDATE penalty_amount = penalty_amount;

    -- Update total_due
    UPDATE payment_schedules ps
    JOIN penalties p ON ps.id = p.schedule_id
    SET ps.penalty_amount = p.penalty_amount, 
        ps.total_due = ps.principal_amount + ps.interest_amount + p.penalty_amount,
        ps.remaining_amount = ps.total_due - ps.paid_amount
    WHERE p.status = 'UNPAID';
END$$

DELIMITER ;