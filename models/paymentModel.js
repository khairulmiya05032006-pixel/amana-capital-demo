import db from '../config/db.js';

/**
 * Search active or all loans by Loan ID, Loan Number, Customer Name, Customer Code, or Mobile Number.
 */
export const searchLoan = async (pool, queryTerm) => {
  try {
    if (!queryTerm || queryTerm.trim() === '') return [];

    const term = `%${queryTerm.trim()}%`;
    const exactId = isNaN(queryTerm) ? -1 : parseInt(queryTerm, 10);

    const [rows] = await pool.query(`
      SELECT 
        l.id,
        l.loan_number,
        l.principal_amount,
        l.annual_interest_rate,
        l.tenure_months,
        l.emi_amount,
        l.outstanding_balance,
        l.loan_status,
        l.created_at,
        cp.id AS customer_id,
        cp.customer_code,
        cp.full_name AS customer_name,
        cp.phone AS customer_phone,
        COALESCE(ls.scheme_name, lt.loan_name) AS loan_type_name
      FROM loans l
      JOIN customer_profiles cp ON l.customer_id = cp.id
      LEFT JOIN loan_schemes ls ON l.loan_type_id = ls.id
      LEFT JOIN loan_types lt ON l.loan_type_id = lt.id
      WHERE l.id = ?
         OR l.loan_number LIKE ?
         OR cp.customer_code LIKE ?
         OR cp.full_name LIKE ?
         OR cp.phone LIKE ?
      ORDER BY l.created_at DESC
      LIMIT 20
    `, [exactId, term, term, term, term]);

    return rows;
  } catch (error) {
    throw new Error(`Error searching loans: ${error.message}`);
  }
};

/**
 * Get comprehensive loan, customer, installment schedule, next EMI due, and payment history details.
 */
export const getLoanDetails = async (pool, loanId) => {
  try {
    const [loans] = await pool.query(`
      SELECT 
        l.*,
        cp.id AS customer_id,
        cp.customer_code,
        cp.full_name AS customer_name,
        cp.phone AS customer_phone,
        cp.address AS customer_address,
        u.email AS customer_email,
        COALESCE(ls.scheme_name, lt.loan_name) AS loan_type_name
      FROM loans l
      JOIN customer_profiles cp ON l.customer_id = cp.id
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN loan_schemes ls ON l.loan_type_id = ls.id
      LEFT JOIN loan_types lt ON l.loan_type_id = lt.id
      WHERE l.id = ? OR l.loan_number = ?
      LIMIT 1
    `, [loanId, loanId]);

    if (loans.length === 0) return null;
    const loan = loans[0];

    // Installments
    const [installments] = await pool.query(`
      SELECT * 
      FROM loan_installments 
      WHERE loan_id = ? 
      ORDER BY installment_number ASC
    `, [loan.id]);

    // Calculate total paid across payments
    const [paidRows] = await pool.query(`
      SELECT COALESCE(SUM(payment_amount), 0) AS total_paid
      FROM payments
      WHERE loan_id = ? AND payment_status = 'SUCCESS'
    `, [loan.id]);
    const totalPaid = parseFloat(paidRows[0].total_paid || 0);

    // Next EMI due
    const [nextEmiRows] = await pool.query(`
      SELECT *
      FROM loan_installments
      WHERE loan_id = ? AND installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
      ORDER BY installment_number ASC, due_date ASC
      LIMIT 1
    `, [loan.id]);
    const nextEmi = nextEmiRows.length > 0 ? nextEmiRows[0] : null;

    // Recent payments history
    const [payments] = await pool.query(`
      SELECT p.*, u.email AS collector_email
      FROM payments p
      LEFT JOIN users u ON p.collected_by = u.id
      WHERE p.loan_id = ?
      ORDER BY p.payment_date DESC
      LIMIT 20
    `, [loan.id]);

    return {
      loan,
      customer: {
        id: loan.customer_id,
        code: loan.customer_code,
        name: loan.customer_name,
        phone: loan.customer_phone,
        email: loan.customer_email,
        address: loan.customer_address
      },
      installments,
      nextEmi,
      totalPaid,
      payments
    };
  } catch (error) {
    throw new Error(`Error fetching loan details: ${error.message}`);
  }
};

/**
 * Record a loan repayment atomically within a database transaction.
 * Supports Normal, Partial, Advance, and Full Settlement payments.
 */
export const recordPayment = async (pool, paymentData) => {
  const {
    loan_id,
    amount,
    payment_method,
    reference_number,
    payment_date,
    remarks,
    admin_id
  } = paymentData;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and validate loan
    const [loans] = await connection.query(`
      SELECT * FROM loans WHERE id = ? FOR UPDATE
    `, [loan_id]);

    if (loans.length === 0) {
      throw new Error('Loan not found');
    }

    const loan = loans[0];

    if (loan.loan_status === 'CLOSED' || loan.loan_status === 'COMPLETED') {
      throw new Error('Loan is already closed/completed');
    }

    if (loan.loan_status !== 'ACTIVE') {
      throw new Error(`Cannot accept payment for loan with status '${loan.loan_status}'`);
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const currentOutstanding = parseFloat(loan.outstanding_balance || 0);

    // Overpayment check (with 1.00 rupee tolerance for floating point calculations)
    if (numericAmount > currentOutstanding + 1.00) {
      throw new Error(`Payment amount (₹${numericAmount.toLocaleString('en-IN')}) exceeds total remaining loan balance (₹${currentOutstanding.toLocaleString('en-IN')}).`);
    }

    // 2. Fetch pending or overdue installments in chronological order
    const [installments] = await connection.query(`
      SELECT * 
      FROM loan_installments 
      WHERE loan_id = ? AND installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
      ORDER BY installment_number ASC, due_date ASC
      FOR UPDATE
    `, [loan_id]);

    let remainingPaymentPool = numericAmount;
    let firstImpactedInstallmentId = installments.length > 0 ? installments[0].id : null;
    let allocatedInstallmentsCount = 0;
    // AUD-06: Track actual waterfall breakdown for accurate payment record
    let totalPenaltyPaid = 0;
    let totalInterestPaid = 0;
    const payDate = payment_date ? new Date(payment_date) : new Date();

    // 3. Chronological distribution of payment pool across installments
    for (const inst of installments) {
      if (remainingPaymentPool <= 0) break;

      const penaltyDue = parseFloat(inst.penalty_amount || 0);
      const principalDue = parseFloat(inst.principal_amount || 0);
      const interestDue = parseFloat(inst.interest_amount || 0);
      const totalInstAmount = parseFloat(inst.total_amount || 0) + penaltyDue;
      const currentPaid = parseFloat(inst.paid_amount || 0);
      const instDue = totalInstAmount - currentPaid;

      if (instDue <= 0.009) continue; // Already fully paid

      const allocation = Math.min(remainingPaymentPool, instDue);
      const newPaidAmount = currentPaid + allocation;
      const newRemaining = Math.max(0, totalInstAmount - newPaidAmount);

      // Track penalty → interest → principal waterfall for this installment
      let alloc = allocation;
      const penaltyAllocated = Math.min(alloc, Math.max(0, penaltyDue - currentPaid));
      alloc -= penaltyAllocated;
      totalPenaltyPaid += penaltyAllocated;
      const interestAllocated = Math.min(alloc, interestDue);
      alloc -= interestAllocated;
      totalInterestPaid += interestAllocated;

      let newStatus = 'PARTIALLY_PAID';
      if (newRemaining <= 0.01) {
        newStatus = 'PAID';
      }

      await connection.query(`
        UPDATE loan_installments
        SET paid_amount = ?,
            remaining_amount = ?,
            installment_status = ?,
            paid_date = ?,
            remarks = COALESCE(?, remarks),
            updated_at = NOW()
        WHERE id = ?
      `, [newPaidAmount, newRemaining, newStatus, payDate, remarks || null, inst.id]);

      remainingPaymentPool -= allocation;
      allocatedInstallmentsCount++;
    }

    // AUD-06: Compute principal paid from the actual waterfall breakdown
    const totalPrincipalPaid = Math.max(0, numericAmount - totalInterestPaid - totalPenaltyPaid);

    // 4. Create primary payment record in `payments` table
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const payNumber = `PAY${Date.now()}${random4}`;
    const refNum = reference_number || `REF-${payNumber}`;

    const [payResult] = await connection.query(`
      INSERT INTO payments (
        payment_number, loan_id, installment_id, customer_id, collected_by,
        payment_date, payment_amount, principal_paid, interest_paid, penalty_paid,
        payment_method, transaction_reference, receipt_number, payment_status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)
    `, [
      payNumber, loan_id, firstImpactedInstallmentId, loan.customer_id, admin_id,
      payDate, numericAmount, totalPrincipalPaid, totalInterestPaid, totalPenaltyPaid,
      payment_method, refNum, `REC-${payNumber}`, remarks || 'Loan Repayment'
    ]);

    const paymentId = payResult.insertId;

    // 5. Calculate new outstanding balance & check for full settlement loan closure
    const newOutstandingBalance = Math.max(0, currentOutstanding - numericAmount);
    let newLoanStatus = loan.loan_status;
    let closedAt = null;

    if (newOutstandingBalance <= 0.01) {
      newLoanStatus = 'CLOSED';
      closedAt = new Date();
    }

    // Update loans table
    await connection.query(`
      UPDATE loans
      SET outstanding_balance = ?,
          loan_status = ?,
          closed_at = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [newOutstandingBalance, newLoanStatus, closedAt, loan_id]);

    // If loan is now CLOSED, force-mark all remaining non-PAID installments as PAID
    // to prevent stale PARTIALLY_PAID statuses from showing after full settlement
    if (newLoanStatus === 'CLOSED') {
      await connection.query(`
        UPDATE loan_installments
        SET installment_status = 'PAID',
            remaining_amount = 0,
            paid_date = COALESCE(paid_date, ?),
            updated_at = NOW()
        WHERE loan_id = ? AND installment_status != 'PAID'
      `, [payDate, loan_id]);
    }

    // 6. Record loan status history if closed
    if (newLoanStatus === 'CLOSED') {
      await connection.query(`
        INSERT INTO loan_status_history (loan_id, old_status, new_status, changed_by, changed_at, remarks)
        VALUES (?, 'ACTIVE', 'CLOSED', ?, NOW(), 'Full Settlement Loan Closure')
      `, [loan_id, admin_id]);
    }

    // 7. Record transaction in `loan_transactions`
    const txnNumber = `TXN${Date.now()}${random4}`;
    await connection.query(`
      INSERT INTO loan_transactions (
        transaction_number, loan_id, installment_id, payment_id, customer_id,
        transaction_type, credit_amount, running_balance, transaction_date,
        reference_number, description, created_by
      ) VALUES (?, ?, ?, ?, ?, 'PAYMENT', ?, ?, ?, ?, ?, ?)
    `, [
      txnNumber, loan_id, firstImpactedInstallmentId, paymentId, loan.customer_id,
      numericAmount, newOutstandingBalance, payDate,
      refNum, remarks || `Loan Payment for ${loan.loan_number}`, admin_id
    ]);

    // 8. Update `admin_account` balance & log `admin_account_transactions`
    await connection.query(`
      UPDATE admin_account SET balance = balance + ?
    `, [numericAmount]);

    const [accRows] = await connection.query(`
      SELECT balance FROM admin_account LIMIT 1
    `);
    const newAdminBalance = accRows.length > 0 ? parseFloat(accRows[0].balance || 0) : numericAmount;

    await connection.query(`
      INSERT INTO admin_account_transactions (
        transaction_type, amount, balance_after, reference, description, created_by
      ) VALUES ('CREDIT', ?, ?, ?, ?, ?)
    `, [numericAmount, newAdminBalance, refNum, `Repayment received for Loan ${loan.loan_number}`, admin_id]);

    // 9. Record audit log
    await connection.query(`
      INSERT INTO audit_logs (
        user_id, module_name, entity_name, entity_id, action, description
      ) VALUES (?, 'Repayments', 'loans', ?, 'PAYMENT', ?)
    `, [
      admin_id, loan_id,
      `Received Loan Payment of ₹${numericAmount.toLocaleString('en-IN')} for Loan ${loan.loan_number} (${payment_method})`
    ]);

    await connection.commit();

    return {
      paymentId,
      paymentNumber: payNumber,
      receiptNumber: `REC-${payNumber}`,
      numericAmount,
      newOutstandingBalance,
      isClosed: newLoanStatus === 'CLOSED',
      allocatedInstallmentsCount
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Fetch all payments by paymentId or loanId.
 */
export const getPaymentById = async (pool, paymentId) => {
  try {
    const [payments] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    return payments.length > 0 ? payments[0] : null;
  } catch (error) {
    throw new Error(`Error fetching payment: ${error.message}`);
  }
};

export const getAllPayments = async (pool) => {
  try {
    const [payments] = await pool.query(`
      SELECT p.*, l.loan_number, cp.full_name AS customer_name
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      JOIN customer_profiles cp ON p.customer_id = cp.id
      ORDER BY p.payment_date DESC
      LIMIT 100
    `);
    return payments;
  } catch (error) {
    throw new Error(`Error fetching payments: ${error.message}`);
  }
};

export const getPaymentsByLoan = async (pool, loanId) => {
  try {
    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date DESC',
      [loanId]
    );
    return payments;
  } catch (error) {
    throw new Error(`Error fetching loan payments: ${error.message}`);
  }
};

export const getPaymentsByCustomer = async (pool, customerId) => {
  try {
    const [payments] = await pool.query(
      'SELECT p.* FROM payments p JOIN loans l ON p.loan_id = l.id WHERE l.customer_id = ? ORDER BY p.payment_date DESC',
      [customerId]
    );
    return payments;
  } catch (error) {
    throw new Error(`Error fetching customer payments: ${error.message}`);
  }
};
