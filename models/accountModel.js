import db from '../config/db.js';

/**
 * Account Model - Handles Admin Operational Treasury Account & Fund Deposits
 */

/**
 * Fetch current admin account balance & summary stats
 */
export const getAccount = async (pool = db) => {
  try {
    const [[acc]] = await pool.query('SELECT balance FROM admin_account LIMIT 1');
    const [[deposits]] = await pool.query("SELECT SUM(amount) as total FROM admin_account_transactions WHERE transaction_type = 'CREDIT'");
    const [[monthDeposits]] = await pool.query("SELECT SUM(amount) as total FROM admin_account_transactions WHERE transaction_type = 'CREDIT' AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())");
    const [[txCount]] = await pool.query('SELECT COUNT(*) as count FROM admin_account_transactions');
    const [[disbursed]] = await pool.query("SELECT SUM(principal_amount) as total FROM loans WHERE loan_status IN ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'OVERDUE')");
    const [[collected]] = await pool.query("SELECT SUM(payment_amount) as total FROM payments WHERE payment_status IN ('SUCCESS', 'COMPLETED', 'VERIFIED')");

    const balance = acc ? parseFloat(acc.balance) : 0.00;
    
    return {
      balance: balance,
      available_balance: balance,
      totalDeposits: deposits?.total ? parseFloat(deposits.total) : 0,
      thisMonthDeposits: monthDeposits?.total ? parseFloat(monthDeposits.total) : 0,
      totalTransactions: txCount?.count ? parseInt(txCount.count) : 0,
      totalDisbursed: disbursed?.total ? parseFloat(disbursed.total) : 0,
      totalCollected: collected?.total ? parseFloat(collected.total) : 0
    };
  } catch (error) {
    throw new Error(`Error fetching admin account: ${error.message}`);
  }
};

/**
 * Execute Fund Deposit Transaction atomically
 */
export const addFunds = async (pool = db, data) => {
  const {
    amount,
    fundingSource,
    paymentMethod,
    referenceNumber,
    depositDate,
    description,
    adminId,
    ipAddress = '127.0.0.1'
  } = data;

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Please enter a valid deposit amount greater than ₹0');
  }

  const validMethods = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];
  const method = (paymentMethod || 'CASH').toUpperCase();
  if (!validMethods.includes(method)) {
    throw new Error('Please select a valid payment method (Cash, UPI, Bank Transfer, Cheque)');
  }

  const refNum = referenceNumber || (method === 'CASH' ? `CASH${Date.now()}` : '');
  if (method !== 'CASH' && (!refNum || refNum.trim() === '')) {
    throw new Error(`Transaction Reference Number is required for ${method} deposits`);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and read current admin account balance
    const [accRows] = await connection.query('SELECT id, balance FROM admin_account LIMIT 1 FOR UPDATE');
    let previousBalance = 0.00;
    let accountId = 1;

    if (accRows.length > 0) {
      previousBalance = parseFloat(accRows[0].balance);
      accountId = accRows[0].id;
    } else {
      // Create admin account row if it doesn't exist
      const [insertAcc] = await connection.query(
        'INSERT INTO admin_account (balance, updated_at) VALUES (0.00, NOW())'
      );
      accountId = insertAcc.insertId;
      previousBalance = 0.00;
    }

    const newBalance = previousBalance + numericAmount;

    // 2. Update admin account balance
    await connection.query(
      'UPDATE admin_account SET balance = ?, updated_at = NOW() WHERE id = ?',
      [newBalance, accountId]
    );

    // 3. Insert transaction into admin_account_transactions
    const dateFormatted = depositDate ? `${depositDate} ${new Date().toTimeString().split(' ')[0]}` : new Date();
    const source = fundingSource || 'Owner Investment';
    const desc = description || `${source} Top-Up via ${method}`;

    const [txResult] = await connection.query(`
      INSERT INTO admin_account_transactions (
        transaction_type, amount, balance_after,
        reference, description, created_by, created_at
      ) VALUES ('CREDIT', ?, ?, ?, ?, ?, ?)
    `, [
      numericAmount, newBalance,
      refNum, desc, adminId || 1, dateFormatted
    ]);

    // 4. Log in audit_logs
    await connection.query(`
      INSERT INTO audit_logs (
        user_id, module_name, entity_name, entity_id, action,
        description, ip_address, created_at
      ) VALUES (?, 'ADMIN_ACCOUNT', 'admin_account', ?, 'ADD_FUNDS', ?, ?, NOW())
    `, [
      adminId || 1, accountId,
      `Added funds of ₹${numericAmount.toLocaleString('en-IN')} to lending capital via ${method} (${source})`,
      ipAddress || '127.0.0.1'
    ]);

    await connection.commit();

    return {
      success: true,
      transactionId: txResult.insertId,
      previousBalance,
      newBalance,
      amount: numericAmount,
      fundingSource: source,
      paymentMethod: method,
      referenceNumber: refNum
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Fetch recent admin account transactions
 */
export const getTransactions = async (pool = db, limit = 50) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, u.email as created_by_name 
      FROM admin_account_transactions t 
      LEFT JOIN users u ON t.created_by = u.id 
      ORDER BY t.created_at DESC 
      LIMIT ?
    `, [limit]);
    return rows;
  } catch (error) {
    throw new Error(`Error fetching account transactions: ${error.message}`);
  }
};
