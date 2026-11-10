import db from '../../config/db.js';
import { InstallmentService } from './installmentService.js';
import { generateLoanNumber } from '../../utils/loanGenerator.js';
import { LOAN_STATUS, LOAN_SOURCE, APPROVAL_TYPE, DISBURSEMENT_TYPE } from '../../utils/constants.js';

class LoanValidationService {
  static async validateDirectLoan(connection, dto) {
    const { customerId, loanTypeId, amount, interestRate, duration, adminId } = dto;

    // Validate Customer
    const [customers] = await connection.query(`SELECT * FROM customer_profiles c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [customerId]);
    if (!customers.length || customers[0].account_status !== 'ACTIVE') {
      throw new Error('Customer is not valid or not active.');
    }

    // Validate Loan Type
    const [loanTypes] = await connection.query(`SELECT * FROM loan_types WHERE id = ?`, [loanTypeId]);
    if (!loanTypes.length) {
      throw new Error('Loan product not found.');
    }

    if (amount <= 0 || duration <= 0) {
      throw new Error('Amount and duration must be positive.');
    }

    // Admin Balance
    const [acc] = await connection.query(`SELECT balance FROM admin_account LIMIT 1`);
    const balance = acc.length ? parseFloat(acc[0].balance) : 0;
    if (balance < amount) {
      throw new Error(`Insufficient admin account balance. Current balance: ₹${balance}, Required: ₹${amount}`);
    }

    return { customer: customers[0], loanType: loanTypes[0], balance };
  }
}

class LoanCreationService {
  static async createLoanRecord(connection, dto, emiDetails) {
    const disbDate = new Date();
    const firstInstDate = new Date();
    firstInstDate.setMonth(firstInstDate.getMonth() + 1);
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + dto.duration);

    // Initial insert with temporary loan number (requires two steps due to ID dependency)
    const [result] = await connection.query(`
      INSERT INTO loans (
        loan_number, application_id, customer_id, loan_type_id, approved_by,
        principal_amount, annual_interest_rate, tenure_months, emi_amount,
        total_interest, total_payable, outstanding_balance, disbursement_date,
        first_installment_date, maturity_date, repayment_frequency, loan_status,
        loan_source, created_by_admin_id, approval_type
      ) VALUES (
        ?, NULL, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `, [
      'TMP-' + Date.now(), dto.customerId, dto.loanTypeId, dto.adminId,
      dto.amount, dto.interestRate, dto.duration, emiDetails.emiAmount,
      emiDetails.totalInterest, emiDetails.totalPayable, dto.amount, disbDate,
      firstInstDate, maturityDate, dto.frequency, LOAN_STATUS.ACTIVE,
      LOAN_SOURCE.DIRECT_ADMIN, dto.adminId, APPROVAL_TYPE.DIRECT_ADMIN
    ]);

    const loanId = result.insertId;
    const loanNumber = generateLoanNumber(loanId);

    await connection.query(`UPDATE loans SET loan_number = ? WHERE id = ?`, [loanNumber, loanId]);

    return { loanId, loanNumber, disbDate, firstInstDate, maturityDate };
  }
}

class LedgerService {
  static async executeLedgerEntries(connection, loan, dto) {
    // Deduct Admin Balance
    await connection.query(`
      UPDATE admin_account 
      SET balance = balance - ?, updated_at = NOW(), updated_by = ?
    `, [dto.amount, dto.adminId]);

    const [acc] = await connection.query(`SELECT balance FROM admin_account LIMIT 1`);
    const newBalance = acc[0].balance;

    // Admin Account Txn
    await connection.query(`
      INSERT INTO admin_account_transactions (
        transaction_type, amount, balance_after, reference, description, created_by
      ) VALUES ('DEBIT', ?, ?, ?, ?, ?)
    `, [dto.amount, newBalance, loan.loanNumber, `Direct loan disbursement for Customer #${dto.customerId}`, dto.adminId]);

    const txnNumber = 'TXN-' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    // Loan Transaction
    await connection.query(`
      INSERT INTO loan_transactions (
        transaction_number, loan_id, customer_id, transaction_type, disbursement_type,
        debit_amount, credit_amount, running_balance, created_by, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      txnNumber, loan.loanId, dto.customerId, 'DISBURSEMENT', DISBURSEMENT_TYPE.DIRECT,
      dto.amount, 0.00, dto.amount, dto.adminId, dto.purpose || 'Direct Admin Disbursement'
    ]);
  }
}

class AuditService {
  static async logDirectLoan(connection, dto, loanId) {
    const metadata = {
      customerId: dto.customerId,
      amount: dto.amount,
      interest: dto.interestRate,
      duration: dto.duration,
      product: dto.loanTypeId,
      purpose: dto.purpose,
      remarks: dto.remarks
    };

    await connection.query(`
      INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, new_values, description)
      VALUES (?, 'Loans', 'loans', ?, 'CREATE', ?, 'Direct Admin Loan Disbursement')
    `, [dto.adminId, loanId, JSON.stringify(metadata)]);
    
    await connection.query(`
      INSERT INTO loan_status_history (loan_id, new_status, remarks, changed_by)
      VALUES (?, ?, ?, ?)
    `, [loanId, LOAN_STATUS.ACTIVE, 'Direct administrator disbursement. ' + (dto.remarks || ''), dto.adminId]);
  }
}

export class DirectLoanService {
  /**
   * Main entry point for Direct Loan Workflow
   * @param {Object} dto - DirectLoanDTO
   */
  static async createDirectLoan(dto) {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Validate
      await LoanValidationService.validateDirectLoan(connection, dto);

      // 2. Generate Schedule in Memory
      const schedule = InstallmentService.generateSchedule({
        principalAmount: dto.amount,
        annualInterestRate: dto.interestRate,
        tenureMonths: dto.duration
      });

      // 3. Create Loan
      const loanMeta = await LoanCreationService.createLoanRecord(connection, dto, schedule);

      // 4. Insert Installments
      await InstallmentService.insertInstallments(connection, loanMeta.loanId, schedule.installments);

      // 5. Ledger
      await LedgerService.executeLedgerEntries(connection, loanMeta, dto);

      // 6. Audit & History
      await AuditService.logDirectLoan(connection, dto, loanMeta.loanId);

      await connection.commit();
      return loanMeta;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
