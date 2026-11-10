import db from '../config/db.js';
import SchemeService from './schemeService.js';
import ScheduleService from './scheduleService.js';

class LoanSchemeAssignmentService {
  /**
   * Assigns a scheme to a newly approved loan, creates a snapshot, 
   * and generates the persistent payment schedule.
   */
  static async assignAndGenerateSchedule(loanId, schemeId, principalAmount, overrides = {}, userId, connection = null) {
    const conn = connection || await db.getConnection();
    let localTransaction = false;

    try {
      if (!connection) {
        await conn.beginTransaction();
        localTransaction = true;
      }

      // 1. Fetch active scheme
      const scheme = await SchemeService.getSchemeById(schemeId, conn);
      if (scheme.status !== 'ACTIVE') {
        throw new Error('Can only assign ACTIVE schemes to a loan');
      }

      // 3. Apply authorized overrides and defaults
      const finalConfig = {
        ...scheme,
        interest_rate: overrides.interest_rate !== undefined ? overrides.interest_rate : scheme.base_interest_rate,
        interest_amount: overrides.interest_amount !== undefined ? overrides.interest_amount : (overrides.flat_interest_amount !== undefined ? overrides.flat_interest_amount : (scheme.base_interest_amount || 0)),
        flat_interest_amount: overrides.flat_interest_amount !== undefined ? overrides.flat_interest_amount : (overrides.interest_amount !== undefined ? overrides.interest_amount : (scheme.base_interest_amount || 0)),
        interest_calculation_method: overrides.calculation_method || overrides.interest_calculation_method || 'FLAT_AMOUNT',
        duration_value: overrides.duration_value !== undefined ? overrides.duration_value : scheme.duration_value,
        duration_unit: overrides.duration_unit !== undefined ? overrides.duration_unit : scheme.duration_unit,
        // The authoritative disbursement workflow has resolved the penalty configuration
        penalty_type: overrides.penalty_type !== undefined ? overrides.penalty_type : scheme.penalty_type,
        penalty_value: overrides.penalty_value !== undefined ? overrides.penalty_value : scheme.penalty_value,
        penalty_calculation_method: overrides.penalty_calculation_method !== undefined ? overrides.penalty_calculation_method : 'PERCENTAGE_OF_OVERDUE',
        fixed_penalty_amount: overrides.fixed_penalty_amount !== undefined ? overrides.fixed_penalty_amount : 0,
        grace_period_days: overrides.grace_period_days !== undefined ? overrides.grace_period_days : (scheme.grace_period_days || 0),
        maximum_penalty_cap: overrides.maximum_penalty_cap !== undefined ? overrides.maximum_penalty_cap : 0,
        penalty_auto_apply: overrides.penalty_auto_apply !== undefined ? overrides.penalty_auto_apply : true
      };

      // 4. Generate the Schedule
      // We need a startDate for the schedule. Assuming 'now' as the disbursement/approval date
      const startDateStr = new Date().toISOString().split('T')[0]; 
      const { installments, summary } = ScheduleService.generateSchedule(finalConfig, principalAmount, startDateStr);

      const roundingAdjustment = summary?.rounding_adjustment !== undefined
        ? summary.rounding_adjustment
        : (overrides.rounding_adjustment || 0.00);

      // 5. Create Immutable Snapshot
      const [snapshotResult] = await conn.query(`
        INSERT INTO loan_scheme_snapshots (
          loan_id, scheme_id, scheme_code, scheme_name, scheme_version,
          interest_type, interest_rate, interest_amount, rounding_adjustment, interest_calculation_method, repayment_frequency,
          duration_value, duration_unit, grace_period_days,
          penalty_type, penalty_value, processing_fee_type, processing_fee_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        loanId, scheme.id, scheme.scheme_code, scheme.scheme_name, scheme.version,
        finalConfig.interest_type, finalConfig.interest_rate, finalConfig.interest_amount, roundingAdjustment, finalConfig.interest_calculation_method, finalConfig.repayment_frequency,
        finalConfig.duration_value, finalConfig.duration_unit, finalConfig.grace_period_days,
        finalConfig.penalty_type, finalConfig.penalty_value, finalConfig.processing_fee_type, finalConfig.processing_fee_value
      ]);

      // 6. Insert into loan_installments
      const scheduleVersion = 'V1_STANDARD'; // Track which algorithm generated this

      for (const inst of installments) {
        await conn.query(`
          INSERT INTO loan_installments (
            loan_id, installment_number, due_date, opening_balance,
            principal_amount, interest_amount, rounding_adjustment, penalty_amount, total_amount,
            paid_amount, remaining_amount, closing_balance, installment_status, payment_frequency, schedule_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, ?, 'PENDING', ?, ?)
        `, [
          loanId, inst.installment_number, inst.due_date, inst.opening_balance,
          inst.principal_amount, inst.interest_amount, inst.rounding_adjustment, inst.total_amount,
          inst.total_amount, inst.closing_balance, finalConfig.repayment_frequency, scheduleVersion
        ]);
      }

      if (localTransaction) await conn.commit();
      return { success: true, summary };
    } catch (error) {
      if (localTransaction) await conn.rollback();
      throw error;
    } finally {
      if (localTransaction) conn.release();
    }
  }
}

export default LoanSchemeAssignmentService;
