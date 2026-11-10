import db from "../config/db.js";
import LoanSchemeAssignmentService from "./loanSchemeAssignmentService.js";

class DisbursementService {
  /**
   * Executes the full atomic disbursement of a loan application.
   */
  static async disburseApplication(applicationId, adminId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Lock the application
      const [applications] = await connection.query(
        "SELECT * FROM loan_applications WHERE id = ? FOR UPDATE",
        [applicationId]
      );

      if (applications.length === 0) {
        throw new Error("Application not found.");
      }

      const application = applications[0];

      // 2. Verify status
      if (application.application_status !== 'APPROVED') {
        throw new Error(`Application must be APPROVED to disburse. Current status: ${application.application_status}`);
      }
      
      const [existingLoans] = await connection.query("SELECT id FROM loans WHERE application_id = ?", [applicationId]);
      if (existingLoans.length > 0) {
        throw new Error("Application has already been disbursed.");
      }

      const effectiveSchemeId = application.loan_scheme_id || application.loan_type_id;
      const principal = application.approved_principal !== null && application.approved_principal !== undefined
        ? parseFloat(application.approved_principal)
        : parseFloat(application.requested_amount);

      const flatInterest = application.approved_interest_amount !== null && application.approved_interest_amount !== undefined
        ? parseFloat(application.approved_interest_amount)
        : 0;

      const calcMethod = application.interest_calculation_method || 'FLAT_AMOUNT';
      
      if (!effectiveSchemeId || isNaN(principal) || principal <= 0) {
        throw new Error("Application is missing approved terms (scheme or amount).");
      }

      // 3. Verify Admin Account Balance
      const [acc] = await connection.query("SELECT balance FROM admin_account LIMIT 1");
      const currentBalance = acc.length > 0 ? parseFloat(acc[0].balance) : 0;

      if (currentBalance < principal) {
        throw new Error(`Insufficient funds in admin account. Current balance: ₹${currentBalance}, Required: ₹${principal}`);
      }

      // 4. Generate Loan Number (LN-YYYYMMDD-XXXX)
      const loanNumber = 'LN-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      const disbursementDate = new Date().toISOString().split('T')[0];

      // 5. Create the Loan Header (temporarily CLOSED to bypass update trigger)
      const effectiveLoanTypeId = application.loan_type_id || 1;
      const exactPayable = Math.round((principal + flatInterest) * 100) / 100;
      const initialTotalPayable = Math.ceil(exactPayable);
      const initialRoundingAdj = Math.round((initialTotalPayable - exactPayable) * 100) / 100;

      const [loanResult] = await connection.query(`
        INSERT INTO loans (
          loan_number, application_id, customer_id, loan_type_id, approved_by,
          principal_amount, flat_interest_amount, rounding_adjustment, outstanding_balance,
          repayment_frequency, loan_status, disbursement_date,
          annual_interest_rate, tenure_months, emi_amount, total_interest, total_payable,
          first_installment_date, maturity_date, interest_calculation_method
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          'MONTHLY', 'CLOSED', ?,
          ?, ?, 1, ?, ?,
          ?, ?, ?
        )
      `, [
        loanNumber, application.id, application.customer_id, effectiveLoanTypeId, application.reviewed_by,
        principal, flatInterest, initialRoundingAdj, initialTotalPayable,
        disbursementDate,
        0.00, application.requested_duration_months || 1, flatInterest, initialTotalPayable,
        disbursementDate, disbursementDate, calcMethod
      ]);

      const loanId = loanResult.insertId;

      // Purge legacy orphan records matching this loan ID to prevent key conflicts and data contamination
      await connection.query("DELETE FROM loan_scheme_snapshots WHERE loan_id = ?", [loanId]);
      await connection.query("DELETE FROM loan_installments WHERE loan_id = ?", [loanId]);
      await connection.query("DELETE FROM loan_transactions WHERE loan_id = ?", [loanId]);
      await connection.query("DELETE FROM penalties WHERE loan_id = ?", [loanId]);
      await connection.query("DELETE FROM payments WHERE loan_id = ?", [loanId]);

      // 6. Deduct balance from Admin Account
      await connection.query("UPDATE admin_account SET balance = balance - ?", [principal]);
      const [newAcc] = await connection.query("SELECT balance FROM admin_account LIMIT 1");
      const newBalance = newAcc[0].balance;

      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const txnNum = 'DISB-' + datePrefix + '-' + Math.floor(1000 + Math.random() * 9000);
      await connection.query(`
        INSERT INTO admin_account_transactions(transaction_type, amount, balance_after, reference, description, created_by)
        VALUES('DEBIT', ?, ?, ?, ?, ?)
      `, [principal, newBalance, txnNum, `Disbursement for Loan ID ${loanId}`, adminId]);

      // 7. Resolve Penalty Configuration & Generate Schedule
      // The disbursement transaction acts as the authoritative boundary.
      const [schemes] = await connection.query("SELECT * FROM loan_schemes WHERE id = ?", [application.loan_scheme_id || application.loan_type_id]);
      if (schemes.length === 0) throw new Error("Scheme not found");
      const scheme = schemes[0];

      let resolvedPenalty = {
        penalty_type: 'NONE',
        penalty_value: 0,
        penalty_calculation_method: 'PERCENTAGE_OF_OVERDUE',
        fixed_penalty_amount: 0,
        grace_period_days: 0,
        maximum_penalty_cap: 0,
        penalty_auto_apply: true
      };

      if (scheme.penalty_mode === 'CUSTOM') {
        resolvedPenalty.penalty_type = scheme.penalty_type;
        resolvedPenalty.penalty_value = scheme.penalty_value;
        resolvedPenalty.grace_period_days = scheme.grace_period_days || 0;
        resolvedPenalty.penalty_calculation_method = scheme.penalty_type === 'FIXED' ? 'FIXED_AMOUNT' : 'PERCENTAGE_OF_OVERDUE';
        resolvedPenalty.fixed_penalty_amount = scheme.penalty_type === 'FIXED' ? scheme.penalty_value : 0;
        resolvedPenalty.maximum_penalty_cap = 0;
        resolvedPenalty.penalty_auto_apply = true;
      } else {
        // INHERIT_FREQUENCY_DEFAULT
        const [penaltyRows] = await connection.query("SELECT * FROM penalty_settings WHERE repayment_frequency = ?", [scheme.repayment_frequency]);
        const globalPenalty = penaltyRows.length > 0 ? penaltyRows[0] : null;
        
        if (globalPenalty && globalPenalty.is_active) {
          resolvedPenalty.penalty_type = globalPenalty.calculation_method === 'FIXED_AMOUNT' ? 'FIXED' : 'PERCENTAGE';
          resolvedPenalty.penalty_value = globalPenalty.calculation_method === 'FIXED_AMOUNT' ? globalPenalty.fixed_penalty_amount : globalPenalty.penalty_rate;
          resolvedPenalty.penalty_calculation_method = globalPenalty.calculation_method;
          resolvedPenalty.fixed_penalty_amount = globalPenalty.fixed_penalty_amount;
          resolvedPenalty.grace_period_days = globalPenalty.grace_period_days;
          resolvedPenalty.maximum_penalty_cap = globalPenalty.maximum_penalty_cap;
          resolvedPenalty.penalty_auto_apply = globalPenalty.auto_apply;
        }
      }

      const overrides = {
        interest_amount: flatInterest,
        flat_interest_amount: flatInterest,
        calculation_method: calcMethod,
        interest_calculation_method: calcMethod,
        interest_rate: application.requested_interest_rate ? parseFloat(application.requested_interest_rate) : undefined,
        duration_value: application.requested_duration_months ? parseInt(application.requested_duration_months, 10) : undefined,
        ...resolvedPenalty
      };
      
      const scheduleData = await LoanSchemeAssignmentService.assignAndGenerateSchedule(loanId, application.loan_scheme_id || application.loan_type_id, principal, overrides, adminId, connection);

      // 8. Back-fill aggregated values in Loans table and activate
      await connection.query(`
        UPDATE loans SET 
          total_interest = ?, flat_interest_amount = ?, rounding_adjustment = ?, total_payable = ?, outstanding_balance = ?, emi_amount = ?, repayment_frequency = ?,
          first_installment_date = ?, maturity_date = ?, annual_interest_rate = 0.00, tenure_months = ?, interest_calculation_method = ?, loan_status = 'ACTIVE'
        WHERE id = ?
      `, [
        scheduleData.summary.total_interest,
        scheduleData.summary.total_interest,
        scheduleData.summary.rounding_adjustment,
        scheduleData.summary.total_payable, 
        scheduleData.summary.total_payable,
        scheduleData.summary.regular_payment, 
        scheduleData.summary.frequency,
        scheduleData.installments?.[0]?.due_date || disbursementDate,
        scheduleData.installments?.[scheduleData.installments.length - 1]?.due_date || disbursementDate,
        scheduleData.summary.total_installments,
        calcMethod,
        loanId
      ]);

      // 9. Application status remains APPROVED (DISBURSED is not a valid enum state, the existence of the Loan record implies disbursement).

      // 10. Record in loan_transactions
      await connection.query(`
        INSERT INTO loan_transactions (transaction_number, loan_id, customer_id, transaction_type, debit_amount, running_balance, created_by)
        VALUES (?, ?, ?, 'DISBURSEMENT', ?, ?, ?)
      `, [txnNum, loanId, application.customer_id, principal, scheduleData.summary.total_payable, adminId]);

      // 11. Record in audit_logs
      await connection.query(`
        INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action)
        VALUES (?, 'Loans', 'loans', ?, 'DISBURSE')
      `, [adminId, loanId]);

      await connection.commit();
      return { success: true, loanId };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

export default DisbursementService;
