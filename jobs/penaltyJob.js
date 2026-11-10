import PenaltyService from '../services/penaltyService.js';
import logger from '../utils/logger.js';
import db from '../config/db.js';

export const runDailyPenalties = async () => {
  logger.info('[PenaltyJob] Starting daily penalty processing...');
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    logger.info('[PenaltyJob] Marking eligible installments as OVERDUE...');
    // Mark overdue before applying penalties
    const [overdueResult] = await connection.query(`
      UPDATE loan_installments 
      SET installment_status = 'OVERDUE' 
      WHERE installment_status = 'PENDING' AND due_date < CURDATE()
    `);
    logger.info(`[PenaltyJob] Marked ${overdueResult.affectedRows} installments as OVERDUE.`);

    logger.info('[PenaltyJob] Calculating and applying penalties...');
    const result = await PenaltyService.applyPenalties(connection);
    
    await connection.commit();
    logger.info(`[PenaltyJob] Completed successfully. Applied ${result.count} new penalties.`);
    return result;
  } catch (error) {
    logger.error('[PenaltyJob] Failed to apply penalties:', error);
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};
