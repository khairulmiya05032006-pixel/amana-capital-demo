import db from '../config/db.js';

class PaymentSummaryService {
  /**
   * Retrieves today's transaction summary and detailed list
   */
  static async getTodayTransactionSummary(pool = db) {
    const [transactions] = await pool.query(`
      SELECT 
        p.id, 
        p.payment_date, 
        p.payment_amount, 
        p.payment_method, 
        p.receipt_number,
        p.transaction_reference,
        cp.full_name AS customer_name,
        l.loan_number,
        lss.repayment_frequency
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      JOIN customer_profiles cp ON l.customer_id = cp.id
      JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      WHERE DATE(p.payment_date) = CURRENT_DATE
        AND p.payment_status = 'SUCCESS'
      ORDER BY p.payment_date DESC
    `);

    let totalCollected = 0;
    const summary = {
      DAILY: { count: 0, amount: 0 },
      WEEKLY: { count: 0, amount: 0 },
      MONTHLY: { count: 0, amount: 0 }
    };

    transactions.forEach(tx => {
      const amount = parseFloat(tx.payment_amount) || 0;
      totalCollected += amount;
      
      const freq = tx.repayment_frequency || 'MONTHLY';
      if (summary[freq]) {
        summary[freq].count += 1;
        summary[freq].amount += amount;
      }
    });

    return {
      date: new Date().toISOString().split('T')[0],
      totalTransactions: transactions.length,
      totalCollected,
      daily: summary.DAILY,
      weekly: summary.WEEKLY,
      monthly: summary.MONTHLY,
      transactions
    };
  }
}

export default PaymentSummaryService;
