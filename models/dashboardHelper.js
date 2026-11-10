// models/dashboardHelper.js

/**
 * Get account summary for a customer.
 * Returns total loans amount and outstanding balance.
 */
export const getAccountSummary = async (db, customerId) => {
  try {
    const [rows] = await db.query(
      `SELECT SUM(principal_amount) AS totalLoans, SUM(outstanding_balance) AS totalOutstanding
       FROM loans WHERE customer_id = ?`,
      [customerId]
    );
    const result = rows[0] || {};
    return {
      totalLoans: result.totalLoans || 0,
      totalOutstanding: result.totalOutstanding || 0,
    };
  } catch (error) {
    throw new Error(`Error fetching account summary: ${error.message}`);
  }
};

/**
 * Get recent loans for a customer with pagination.
 * Defaults to limit=5, offset computed from page (1‑based).
 */
export const getRecentLoansByCustomer = async (db, customerId, page = 1, limit = 5) => {
  const offset = (page - 1) * limit;
  try {
    const [loans] = await db.query(
      `SELECT * FROM loans WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [customerId, limit, offset]
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM loans WHERE customer_id = ?`,
      [customerId]
    );
    const total = countRows[0].total || 0;
    return { loans, total };
  } catch (error) {
    throw new Error(`Error fetching recent loans: ${error.message}`);
  }
};

/**
 * Get upcoming payments for a customer with pagination.
 * Defaults to limit=5, page=1.
 */
export const getUpcomingPayments = async (db, customerId, page = 1, limit = 5) => {
  const offset = (page - 1) * limit;
  try {
    const [payments] = await db.query(
      `SELECT i.* FROM loan_installments i 
       JOIN loans l ON i.loan_id = l.id 
       WHERE l.customer_id = ? AND i.status = 'PENDING' 
       ORDER BY i.due_date ASC LIMIT ? OFFSET ?`,
      [customerId, limit, offset]
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM loan_installments i 
       JOIN loans l ON i.loan_id = l.id 
       WHERE l.customer_id = ? AND i.status = 'PENDING'`,
      [customerId]
    );
    const total = countRows[0].total || 0;
    return { payments, total };
  } catch (error) {
    throw new Error(`Error fetching upcoming payments: ${error.message}`);
  }
};
