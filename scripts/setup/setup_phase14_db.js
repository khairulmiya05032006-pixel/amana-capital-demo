import mysql from 'mysql2/promise';
import dotenv from 'dotenv/config';

async function setupDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 16510,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    });

    console.log('Connected to MySQL DB.');

    // 1. Check & Add disbursement columns to loans table
    const [disbursedCol] = await connection.query("SHOW COLUMNS FROM loans LIKE 'disbursed'");
    if (disbursedCol.length === 0) {
      console.log('Adding disbursed column to loans table...');
      await connection.query("ALTER TABLE loans ADD COLUMN disbursed BOOLEAN DEFAULT FALSE");
    }
    const [disbursedAtCol] = await connection.query("SHOW COLUMNS FROM loans LIKE 'disbursed_at'");
    if (disbursedAtCol.length === 0) {
      console.log('Adding disbursed_at column to loans table...');
      await connection.query("ALTER TABLE loans ADD COLUMN disbursed_at DATETIME NULL");
    }
    const [disbursedByCol] = await connection.query("SHOW COLUMNS FROM loans LIKE 'disbursed_by'");
    if (disbursedByCol.length === 0) {
      console.log('Adding disbursed_by column to loans table...');
      await connection.query("ALTER TABLE loans ADD COLUMN disbursed_by BIGINT UNSIGNED NULL");
      try {
        await connection.query("ALTER TABLE loans ADD CONSTRAINT fk_loans_disbursed_by FOREIGN KEY (disbursed_by) REFERENCES users(id)");
      } catch (fkErr) {
        console.log('FK constraint warning:', fkErr.message);
      }
    }

    // 2. Create admin_account table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_account (
        id            INT PRIMARY KEY AUTO_INCREMENT,
        balance       DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by    BIGINT UNSIGNED,
        CONSTRAINT chk_admin_account_balance CHECK (balance >= 0),
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Seed initial balance if empty
    const [accountRows] = await connection.query("SELECT * FROM admin_account LIMIT 1");
    if (accountRows.length === 0) {
      console.log('Seeding initial admin_account row...');
      await connection.query("INSERT INTO admin_account (balance) VALUES (0.00)");
    }

    // 3. Create admin_account_transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_account_transactions (
        id               BIGINT PRIMARY KEY AUTO_INCREMENT,
        transaction_type ENUM('CREDIT', 'DEBIT') NOT NULL,
        amount           DECIMAL(15, 2) NOT NULL,
        balance_after    DECIMAL(15, 2) NOT NULL,
        reference        VARCHAR(100),
        description      TEXT,
        created_by       BIGINT UNSIGNED,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // 4. Create or Replace View vw_overdue_loans
    console.log('Creating or replacing view vw_overdue_loans...');
    await connection.query(`
      CREATE OR REPLACE VIEW vw_overdue_loans AS
      SELECT
        li.id AS installment_id,
        li.loan_id,
        l.loan_number,
        cp.full_name AS borrower_name,
        cp.phone AS borrower_phone,
        li.installment_number AS installment_no,
        li.due_date,
        li.total_amount AS installment_amount,
        GREATEST(0, li.total_amount + COALESCE(li.penalty_amount, 0) - li.paid_amount) AS remaining_amount,
        COALESCE(li.penalty_amount, 0) AS penalty_amount,
        DATEDIFF(CURRENT_DATE, li.due_date) AS days_overdue
      FROM loan_installments li
      JOIN loans l ON li.loan_id = l.id
      JOIN customer_profiles cp ON l.customer_id = cp.id
      WHERE li.installment_status = 'OVERDUE'
      ORDER BY li.due_date ASC;
    `);

    // 5. Update Stored Procedure sp_record_payment
    console.log('Updating sp_record_payment stored procedure...');
    await connection.query(`DROP PROCEDURE IF EXISTS sp_record_payment`);
    await connection.query(`
      CREATE PROCEDURE sp_record_payment(
        IN p_loan_id BIGINT, 
        IN p_installment_id BIGINT, 
        IN p_customer_id BIGINT,
        IN p_amount DECIMAL(15,2), 
        IN p_method VARCHAR(20),
        IN p_reference VARCHAR(50),
        IN p_collected_by BIGINT UNSIGNED
      )
      BEGIN
        DECLARE v_pay_num VARCHAR(30);
        DECLARE v_txn_num VARCHAR(30);
        DECLARE v_new_balance DECIMAL(15,2);

        DECLARE EXIT HANDLER FOR SQLEXCEPTION 
        BEGIN
          ROLLBACK;
          RESIGNAL;
        END;

        START TRANSACTION;

          SET v_pay_num = CONCAT('PAY', DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s%f'), p_loan_id);
          
          INSERT INTO payments(payment_number, loan_id, installment_id, customer_id, payment_date, payment_amount, principal_paid, interest_paid, penalty_paid, payment_method, transaction_reference, collected_by)
          VALUES(v_pay_num, p_loan_id, p_installment_id, p_customer_id, NOW(), p_amount, p_amount, 0, 0, p_method, p_reference, p_collected_by);

          UPDATE loan_installments
          SET paid_amount = paid_amount + p_amount,
              installment_status = CASE WHEN paid_amount + p_amount >= (total_amount + COALESCE(penalty_amount, 0)) THEN 'PAID' ELSE installment_status END
          WHERE id = p_installment_id AND loan_id = p_loan_id;

          UPDATE loans
          SET outstanding_balance = GREATEST(0, outstanding_balance - p_amount)
          WHERE id = p_loan_id;

          SET v_txn_num = CONCAT('TXN', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), p_loan_id);
          INSERT INTO loan_transactions(transaction_number, loan_id, customer_id, transaction_type, credit_amount, running_balance, created_by)
          VALUES(v_txn_num, p_loan_id, p_customer_id, 'PAYMENT', p_amount, (SELECT outstanding_balance FROM loans WHERE id = p_loan_id), p_collected_by);

          -- Update Admin Account & Log Transaction (Option A)
          UPDATE admin_account SET balance = balance + p_amount;
          SELECT balance INTO v_new_balance FROM admin_account LIMIT 1;
          
          INSERT INTO admin_account_transactions(transaction_type, amount, balance_after, reference, description, created_by)
          VALUES('CREDIT', p_amount, v_new_balance, p_reference, CONCAT('EMI Payment received for Loan ID ', p_loan_id), p_collected_by);

          IF (SELECT outstanding_balance FROM loans WHERE id = p_loan_id) <= 0 THEN
            CALL sp_close_loan(p_loan_id, p_collected_by);
          END IF;

        COMMIT;
      END
    `);

    // 6. Update Stored Procedure sp_disburse_loan
    console.log('Updating sp_disburse_loan stored procedure...');
    await connection.query(`DROP PROCEDURE IF EXISTS sp_disburse_loan`);
    await connection.query(`
      CREATE PROCEDURE sp_disburse_loan(IN p_loan_id BIGINT, IN p_admin_id BIGINT UNSIGNED)
      BEGIN
        DECLARE v_status VARCHAR(20);
        DECLARE v_disbursed BOOLEAN;
        DECLARE v_principal DECIMAL(15,2);
        DECLARE v_customer_id BIGINT;
        DECLARE v_current_balance DECIMAL(15,2);
        DECLARE v_new_balance DECIMAL(15,2);
        DECLARE v_txn_num VARCHAR(30);

        DECLARE EXIT HANDLER FOR SQLEXCEPTION 
        BEGIN
          ROLLBACK;
          RESIGNAL;
        END;

        START TRANSACTION;

          SELECT loan_status, COALESCE(disbursed, FALSE), principal_amount, customer_id 
          INTO v_status, v_disbursed, v_principal, v_customer_id
          FROM loans
          WHERE id = p_loan_id;

          IF v_status != 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loan must be in ACTIVE status to disburse';
          END IF;

          IF v_disbursed = TRUE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loan is already disbursed';
          END IF;

          SELECT balance INTO v_current_balance FROM admin_account LIMIT 1;
          IF v_current_balance < v_principal THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds in admin account to disburse this loan';
          END IF;

          -- Deduct balance
          UPDATE admin_account SET balance = balance - v_principal;
          SELECT balance INTO v_new_balance FROM admin_account LIMIT 1;

          -- Mark loan as disbursed
          UPDATE loans 
          SET disbursed = TRUE, 
              disbursed_at = NOW(), 
              disbursed_by = p_admin_id 
          WHERE id = p_loan_id;

          -- Record transaction in admin_account_transactions
          SET v_txn_num = CONCAT('TXNDISB', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), p_loan_id);
          INSERT INTO admin_account_transactions(transaction_type, amount, balance_after, reference, description, created_by)
          VALUES('DEBIT', v_principal, v_new_balance, v_txn_num, CONCAT('Disbursement for Loan ID ', p_loan_id), p_admin_id);

          -- Record in loan_transactions
          INSERT INTO loan_transactions (transaction_number, loan_id, customer_id, transaction_type, debit_amount, running_balance, created_by)
          VALUES (v_txn_num, p_loan_id, v_customer_id, 'DISBURSEMENT', v_principal, (SELECT total_payable FROM loans WHERE id = p_loan_id), p_admin_id);

          -- Record in audit_logs
          INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action)
          VALUES (p_admin_id, 'Loans', 'loans', p_loan_id, 'DISBURSE');

        COMMIT;
      END
    `);

    console.log('Database setup completed successfully.');
  } catch (err) {
    console.error('Database setup failed:', err);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
