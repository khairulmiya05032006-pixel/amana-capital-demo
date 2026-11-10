

DELIMITER $$
DROP PROCEDURE IF EXISTS sp_disburse_loan$$
CREATE PROCEDURE sp_disburse_loan(IN p_app_id BIGINT, IN p_admin_id BIGINT)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_customer_id BIGINT;
    DECLARE v_loan_type_id BIGINT;
    DECLARE v_principal DECIMAL(15,2);
    DECLARE v_rate DECIMAL(5,2);
    DECLARE v_tenure INT;
    DECLARE v_interest DECIMAL(15,2);
    DECLARE v_total DECIMAL(15,2);
    DECLARE v_emi DECIMAL(15,2);
    DECLARE v_loan_id BIGINT;
    DECLARE v_loan_num VARCHAR(30);
    DECLARE v_txn_num VARCHAR(30);

    -- 1. Validate Application Status
    SELECT 
        a.application_status, a.customer_id, a.loan_type_id, a.requested_amount, 
        COALESCE(a.requested_interest_rate, t.minimum_interest_rate), a.requested_duration_months
    INTO v_status, v_customer_id, v_loan_type_id, v_principal, v_rate, v_tenure
    FROM loan_applications a
    JOIN loan_types t ON a.loan_type_id = t.id
    WHERE a.id = p_app_id;

    IF v_status != 'APPROVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application must be APPROVED before disbursal';
    END IF;

    -- 2. Prevent Double Disbursal
    IF EXISTS (SELECT 1 FROM loans WHERE application_id = p_app_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loan already exists for this application';
    END IF;

    -- 3. Calculate Financials
    SET v_interest = (v_principal * v_rate * (v_tenure / 12)) / 100;
    SET v_total = v_principal + v_interest;
    SET v_emi = v_total / v_tenure;
    SET v_loan_num = CONCAT('LN', DATE_FORMAT(NOW(), '%Y%m%d'), p_app_id);
    SET v_txn_num = CONCAT('TXN', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), p_app_id);

    -- 4. Create Loan
    INSERT INTO loans (loan_number, application_id, customer_id, loan_type_id, approved_by, principal_amount, annual_interest_rate, tenure_months, emi_amount, total_interest, total_payable, outstanding_balance, disbursement_date, first_installment_date, maturity_date, loan_status)
    VALUES (v_loan_num, p_app_id, v_customer_id, v_loan_type_id, p_admin_id, v_principal, v_rate, v_tenure, v_emi, v_interest, v_total, v_total, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), DATE_ADD(CURDATE(), INTERVAL v_tenure MONTH), 'ACTIVE');

    SET v_loan_id = LAST_INSERT_ID();

    -- 5. Generate EMI Schedule
    CALL sp_generate_emi_schedule(v_loan_id);

    -- 6. Record Disbursement Transaction
    INSERT INTO loan_transactions (transaction_number, loan_id, customer_id, transaction_type, debit_amount, running_balance, created_by)
    VALUES (v_txn_num, v_loan_id, v_customer_id, 'DISBURSEMENT', v_principal, v_total, p_admin_id);
    
    -- 7. Update Application Status to DISBURSED (Optional if you want to distinguish)
    -- Actually, we can keep it as APPROVED but the existence of a Loan means it's disbursed.
    -- Or we can change the ENUM? The user said "Option A ... requires no schema ENUM changes".
    -- So we just leave application_status as 'APPROVED' but we record the audit log.

    -- 8. Add Loan Status History
    INSERT INTO loan_status_history (loan_id, old_status, new_status, remarks, changed_by)
    VALUES (v_loan_id, 'PENDING', 'ACTIVE', 'Initial Loan Disbursal', p_admin_id);

    -- 9. Audit Log
    INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action)
    VALUES (p_admin_id, 'Loans', 'loans', v_loan_id, 'DISBURSE');

END$$
DELIMITER ;
