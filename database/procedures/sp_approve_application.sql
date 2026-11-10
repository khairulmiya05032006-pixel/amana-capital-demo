

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_approve_application$$

CREATE PROCEDURE sp_approve_application(
    IN p_app_id BIGINT, 
    IN p_admin_id BIGINT,
    IN p_approved_amount DECIMAL(15,2),
    IN p_interest_rate DECIMAL(5,2),
    IN p_tenure_months SMALLINT UNSIGNED
)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_app_number VARCHAR(30);
    DECLARE v_customer_id BIGINT UNSIGNED;
    DECLARE v_loan_type_id BIGINT UNSIGNED;
    
    DECLARE v_loan_number VARCHAR(30);
    DECLARE v_loan_id BIGINT UNSIGNED;
    DECLARE v_monthly_rate DECIMAL(15,8);
    DECLARE v_emi_amount DECIMAL(15,2);
    DECLARE v_total_payable DECIMAL(15,2);
    DECLARE v_total_interest DECIMAL(15,2);
    
    DECLARE v_disbursement_date DATE;
    DECLARE v_first_inst_date DATE;
    DECLARE v_maturity_date DATE;
    DECLARE v_txn_number VARCHAR(30);
    
    DECLARE i INT DEFAULT 1;
    DECLARE v_out_balance DECIMAL(15,2);
    DECLARE v_inst_interest DECIMAL(15,2);
    DECLARE v_inst_principal DECIMAL(15,2);
    DECLARE v_due_date DATE;
    
    -- START TRANSACTION handled by JS caller

    SELECT application_status, application_number, customer_id, loan_type_id
    INTO v_status, v_app_number, v_customer_id, v_loan_type_id
    FROM loan_applications
    WHERE id = p_app_id FOR UPDATE;

    IF v_status != 'PENDING' AND v_status != 'UNDER_REVIEW' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application is not pending or under review';
    END IF;

    -- EMI Calculations
    SET v_monthly_rate = p_interest_rate / 12 / 100;
    
    IF v_monthly_rate = 0 THEN
        SET v_emi_amount = ROUND(p_approved_amount / p_tenure_months, 2);
    ELSE
        SET v_emi_amount = ROUND((p_approved_amount * v_monthly_rate * POW(1 + v_monthly_rate, p_tenure_months)) / (POW(1 + v_monthly_rate, p_tenure_months) - 1), 2);
    END IF;
    
    SET v_total_payable = v_emi_amount * p_tenure_months;
    SET v_total_interest = v_total_payable - p_approved_amount;
    
    -- Dates
    SET v_disbursement_date = CURDATE();
    SET v_first_inst_date = DATE_ADD(v_disbursement_date, INTERVAL 1 MONTH);
    SET v_maturity_date = DATE_ADD(v_disbursement_date, INTERVAL p_tenure_months MONTH);
    
    -- Generate Loan Number (LN-YYYYMMDD-XXXX)
    SET v_loan_number = CONCAT('LN-', DATE_FORMAT(CURDATE(), '%Y%m%d'), '-', LPAD(FLOOR(RAND() * 9999), 4, '0'));

    -- Update Application (Status only, preserve original requested_amount)
    UPDATE loan_applications 
    SET application_status = 'APPROVED', 
        reviewed_by = p_admin_id, 
        reviewed_at = NOW() 
    WHERE id = p_app_id;

    -- Create Loan Record
    INSERT INTO loans (
        loan_number, application_id, customer_id, loan_type_id, approved_by,
        principal_amount, annual_interest_rate, tenure_months, emi_amount,
        total_interest, total_payable, outstanding_balance, disbursement_date,
        first_installment_date, maturity_date, repayment_frequency, loan_status
    ) VALUES (
        v_loan_number, p_app_id, v_customer_id, v_loan_type_id, p_admin_id,
        p_approved_amount, p_interest_rate, p_tenure_months, v_emi_amount,
        v_total_interest, v_total_payable, p_approved_amount, v_disbursement_date,
        v_first_inst_date, v_maturity_date, 'MONTHLY', 'ACTIVE'
    );
    
    SET v_loan_id = LAST_INSERT_ID();

    -- Generate Installments Loop
    SET v_out_balance = p_approved_amount;
    SET v_due_date = v_first_inst_date;
    
    WHILE i <= p_tenure_months DO
        IF i = p_tenure_months THEN
            -- Last installment adjusts any rounding differences
            SET v_inst_principal = v_out_balance;
            SET v_inst_interest = ROUND(v_emi_amount - v_inst_principal, 2);
            IF v_inst_interest < 0 THEN 
                SET v_inst_interest = 0; 
                SET v_emi_amount = v_inst_principal;
            END IF;
        ELSE
            SET v_inst_interest = ROUND(v_out_balance * v_monthly_rate, 2);
            SET v_inst_principal = v_emi_amount - v_inst_interest;
        END IF;
        
        SET v_out_balance = ROUND(v_out_balance - v_inst_principal, 2);
        
        INSERT INTO loan_installments (
            loan_id, installment_number, due_date, opening_balance,
            principal_amount, interest_amount, total_amount, remaining_amount,
            closing_balance, installment_status
        ) VALUES (
            v_loan_id, i, v_due_date, ROUND(v_out_balance + v_inst_principal, 2),
            v_inst_principal, v_inst_interest, v_emi_amount, v_emi_amount,
            v_out_balance, 'PENDING'
        );
        
        SET v_due_date = DATE_ADD(v_due_date, INTERVAL 1 MONTH);
        SET i = i + 1;
    END WHILE;

    -- Update Admin Account Balance (Debit)
    UPDATE admin_account 
    SET balance = balance - p_approved_amount, updated_at = NOW(), updated_by = p_admin_id;

    -- Record Admin Account Transaction
    INSERT INTO admin_account_transactions (
        transaction_type, amount, balance_after, reference, description, created_by
    )
    SELECT 'DEBIT', p_approved_amount, balance, v_loan_number, 
           CONCAT('Loan disbursement for ', v_app_number), p_admin_id
    FROM admin_account LIMIT 1;

    -- Generate Transaction Number
    SET v_txn_number = CONCAT('TXN-', DATE_FORMAT(CURDATE(), '%Y%m%d'), '-', LPAD(FLOOR(RAND() * 9999), 4, '0'));

    -- Record Loan Transaction (Disbursement)
    INSERT INTO loan_transactions (
        transaction_number, loan_id, customer_id, transaction_type, 
        debit_amount, credit_amount, running_balance, created_by, description
    ) VALUES (
        v_txn_number, v_loan_id, v_customer_id, 'DISBURSEMENT', 
        p_approved_amount, 0.00, p_approved_amount, p_admin_id, 'Loan disbursed on approval'
    );

    -- Audit Log (Simple)
    INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action)
    VALUES (p_admin_id, 'Loans', 'loan_applications', p_app_id, 'APPROVE');

END$$
DELIMITER ;
