import db from '../config/db.js';

class PenaltyService {
  /**
   * Identifies overdue installments that have passed their grace period
   * and applies the penalty defined in the current penalty_settings for that frequency.
   * This is designed to be idempotent and can be run nightly via cron.
   */
  static async applyPenalties(externalConn = null) {
    const connection = externalConn || await db.getConnection();
    let isLocalTransaction = false;
    try {
      if (!externalConn) {
        await connection.beginTransaction();
        isLocalTransaction = true;
      }

      const query = `
        SELECT 
          i.id as installment_id, 
          i.loan_id, 
          (i.total_amount - i.paid_amount) as eligible_amount, 
          l.principal_amount,
          s.repayment_frequency as frequency,
          ps.calculation_method as penalty_type, 
          ps.penalty_rate as penalty_value,
          ps.grace_period_days,
          ps.maximum_penalty_cap,
          ps.auto_apply as penalty_auto_apply,
          ps.fixed_penalty_amount,
          ps.version as policy_version,
          (SELECT COALESCE(SUM(penalty_amount), 0) FROM penalties WHERE loan_id = i.loan_id AND status IN ('APPLIED', 'UNPAID', 'PARTIALLY_PAID', 'PAID')) as current_total_penalty
        FROM loan_installments i
        JOIN loan_scheme_snapshots s ON i.loan_id = s.loan_id
        JOIN loans l ON i.loan_id = l.id
        JOIN penalty_settings ps ON s.repayment_frequency = ps.repayment_frequency
        WHERE i.installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
          AND ps.auto_apply = TRUE
          AND (ps.calculation_method != 'NONE' OR ps.penalty_rate > 0 OR ps.fixed_penalty_amount > 0)
          AND DATE_ADD(i.due_date, INTERVAL ps.grace_period_days DAY) < CURDATE()
          AND NOT EXISTS (
            SELECT 1 FROM penalties p 
            WHERE p.installment_id = i.id 
              AND p.penalty_type = 'LATE_PAYMENT'
          )
      `;
      
      const [overdueInstallments] = await connection.query(query);
      let appliedCount = 0;
      const runningLoanPenalties = new Map();

      for (const inst of overdueInstallments) {
        let penaltyAmount = 0;
        
        if (inst.penalty_type === 'FIXED_AMOUNT') {
          penaltyAmount = parseFloat(inst.fixed_penalty_amount);
        } else if (inst.penalty_type === 'PERCENTAGE_OF_OVERDUE') {
          penaltyAmount = (parseFloat(inst.eligible_amount) * parseFloat(inst.penalty_value)) / 100.0;
        }

        penaltyAmount = Math.round(penaltyAmount * 100) / 100;

        if (penaltyAmount > 0) {
          // Apply Maximum Penalty Cap (cumulative)
          const maxCapPercentage = parseFloat(inst.maximum_penalty_cap);
          if (maxCapPercentage > 0) {
            const maximumPenalty = (parseFloat(inst.principal_amount) * maxCapPercentage) / 100.0;
            const existingPenaltyTotal = runningLoanPenalties.has(inst.loan_id)
              ? runningLoanPenalties.get(inst.loan_id)
              : parseFloat(inst.current_total_penalty);
            const remainingPenaltyCapacity = maximumPenalty - existingPenaltyTotal;
            
            if (remainingPenaltyCapacity <= 0) {
              penaltyAmount = 0;
            } else {
              penaltyAmount = Math.min(penaltyAmount, remainingPenaltyCapacity);
              penaltyAmount = Math.max(0, Math.round(penaltyAmount * 100) / 100);
            }
          }

          if (penaltyAmount > 0) {
            try {
              // 1. Insert into penalties table (idempotency guard via unique constraint)
              await connection.query(`
                INSERT INTO penalties (installment_id, loan_id, penalty_amount, penalty_type, policy_version, status)
                VALUES (?, ?, ?, 'LATE_PAYMENT', ?, 'APPLIED')
              `, [inst.installment_id, inst.loan_id, penaltyAmount, inst.policy_version]);

              // 2. Update loan_installments (preserve scheduled total_amount as base, increment penalty_amount)
              await connection.query(`
                UPDATE loan_installments 
                SET penalty_amount = penalty_amount + ?,
                    installment_status = 'OVERDUE'
                WHERE id = ?
              `, [penaltyAmount, inst.installment_id]);
              
              // Track cumulative penalty for this loan
              const prevTotal = runningLoanPenalties.has(inst.loan_id)
                ? runningLoanPenalties.get(inst.loan_id)
                : parseFloat(inst.current_total_penalty);
              runningLoanPenalties.set(inst.loan_id, prevTotal + penaltyAmount);

              appliedCount++;
            } catch (insertError) {
              if (insertError.code !== 'ER_DUP_ENTRY') {
                throw insertError;
              }
            }
          }
        }
      }

      if (isLocalTransaction) await connection.commit();
      return { success: true, count: appliedCount };
    } catch (error) {
      if (isLocalTransaction && connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (isLocalTransaction && connection) {
        connection.release();
      }
    }
  }

  /**
   * Synchronize active eligible overdue installments with the new penalty policy.
   * Calculates the delta and creates a POLICY_ADJUSTMENT record.
   */
  static async syncUnpostedPenalties(connection) {
    const query = `
      SELECT 
        i.id as installment_id, 
        i.loan_id, 
        (i.total_amount - i.paid_amount - i.penalty_amount) as eligible_amount, 
        l.principal_amount,
        s.repayment_frequency as frequency,
        ps.calculation_method as penalty_type, 
        ps.penalty_rate as penalty_value,
        ps.grace_period_days,
        ps.maximum_penalty_cap,
        ps.auto_apply as penalty_auto_apply,
        ps.fixed_penalty_amount,
        ps.version as policy_version,
        (SELECT COALESCE(SUM(penalty_amount), 0) FROM penalties WHERE installment_id = i.id AND status = 'APPLIED') as existing_applied_penalty,
        (SELECT COALESCE(SUM(penalty_amount), 0) FROM penalties WHERE loan_id = i.loan_id AND status IN ('APPLIED', 'UNPAID', 'PARTIALLY_PAID', 'PAID')) as current_total_penalty
      FROM loan_installments i
      JOIN loan_scheme_snapshots s ON i.loan_id = s.loan_id
      JOIN loans l ON i.loan_id = l.id
      JOIN penalty_settings ps ON s.repayment_frequency = ps.repayment_frequency
      WHERE i.installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
        AND DATE_ADD(i.due_date, INTERVAL ps.grace_period_days DAY) < CURDATE()
        AND i.penalty_amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM penalties p 
          WHERE p.installment_id = i.id 
            AND p.penalty_type = 'POLICY_ADJUSTMENT'
            AND p.policy_version = ps.version
        )
      FOR UPDATE
    `;

    const [installments] = await connection.query(query);

    for (const inst of installments) {
      let expectedPenalty = 0;
      
      if (inst.penalty_type === 'FIXED_AMOUNT') {
        expectedPenalty = parseFloat(inst.fixed_penalty_amount);
      } else if (inst.penalty_type === 'PERCENTAGE_OF_OVERDUE') {
        expectedPenalty = (parseFloat(inst.eligible_amount) * parseFloat(inst.penalty_value)) / 100.0;
      }

      expectedPenalty = Math.round(expectedPenalty * 100) / 100;

      // Apply Maximum Penalty Cap
      const maxCapPercentage = parseFloat(inst.maximum_penalty_cap);
      if (maxCapPercentage > 0) {
        const maximumPenalty = (parseFloat(inst.principal_amount) * maxCapPercentage) / 100.0;
        const totalOtherPenalties = parseFloat(inst.current_total_penalty) - parseFloat(inst.existing_applied_penalty);
        const remainingPenaltyCapacity = maximumPenalty - totalOtherPenalties;
        
        if (remainingPenaltyCapacity <= 0) {
          expectedPenalty = 0;
        } else {
          expectedPenalty = Math.min(expectedPenalty, remainingPenaltyCapacity);
          expectedPenalty = Math.max(0, Math.round(expectedPenalty * 100) / 100);
        }
      }

      const existingAppliedPenalty = parseFloat(inst.existing_applied_penalty);
      const adjustment = expectedPenalty - existingAppliedPenalty;

      if (Math.abs(adjustment) > 0.01) {
        try {
          await connection.query(`
            INSERT INTO penalties (installment_id, loan_id, penalty_amount, penalty_type, policy_version, status)
            VALUES (?, ?, ?, 'POLICY_ADJUSTMENT', ?, 'APPLIED')
            ON DUPLICATE KEY UPDATE penalty_amount = VALUES(penalty_amount), status = VALUES(status)
          `, [inst.installment_id, inst.loan_id, adjustment, inst.policy_version]);

          await connection.query(`
            UPDATE loan_installments 
            SET penalty_amount = penalty_amount + ?
            WHERE id = ?
          `, [adjustment, inst.installment_id]);
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY') throw err;
        }
      }
    }
  }

  /**
   * Waive a penalty for a specific installment
   */
  static async waivePenalty(installmentId, userId, reason) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [penalties] = await connection.query(
        `SELECT * FROM penalties WHERE installment_id = ? AND status = 'APPLIED'`,
        [installmentId]
      );

      if (penalties.length === 0) {
        throw new Error('No applied penalty found for this installment');
      }

      let totalWaived = 0;
      for (const p of penalties) {
        totalWaived += parseFloat(p.penalty_amount);
        await connection.query(`UPDATE penalties SET status = 'WAIVED' WHERE id = ?`, [p.id]);
      }

      await connection.query(`
        UPDATE loan_installments 
        SET penalty_amount = GREATEST(0, penalty_amount - ?)
        WHERE id = ?
      `, [totalWaived, installmentId]);

      await connection.query(`
        INSERT INTO audit_logs (
          user_id, module_name, entity_name, action, description, ip_address, created_at
        ) VALUES (?, 'LOANS', 'penalties', 'WAIVE', ?, '127.0.0.1', NOW())
      `, [userId, `Waived ${totalWaived} penalty for installment ${installmentId}. Reason: ${reason}`]);

      await connection.commit();
      return { success: true, amountWaived: totalWaived };
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

export default PenaltyService;
