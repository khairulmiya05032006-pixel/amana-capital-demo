import db from '../config/db.js';
import * as paymentModel from '../models/paymentModel.js';
import CustomerRepaymentPortfolioService from '../services/customerRepaymentPortfolioService.js';
import PaymentSummaryService from '../services/paymentSummaryService.js';

/**
 * Render the main Admin Repayments page (views/admin/repayments.ejs)
 */
export const showRepaymentPage = async (req, res, next) => {
  try {
    const searchId = req.query.q || req.query.loanId || '';
    const frequency = req.query.frequency || 'ALL';
    const status = req.query.status || 'ALL';
    
    let loanDetails = null;

    if (req.query.loanId) {
      loanDetails = await paymentModel.getLoanDetails(db, req.query.loanId);
    }

    const [recentPayments] = await db.query(`
      SELECT p.*, l.loan_number, cp.full_name AS customer_name, cp.phone AS customer_phone
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      JOIN customer_profiles cp ON p.customer_id = cp.id
      ORDER BY p.payment_date DESC
      LIMIT 20
    `);

    const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

    // Calculate System-Wide Repayment KPIs using the new service
    const summary = await CustomerRepaymentPortfolioService.getPortfolioSummary();
    
    // Fetch Repayment Portfolio
    const portfolio = await CustomerRepaymentPortfolioService.getRepaymentPortfolio({ frequency, status, q: searchId });

    // Fetch Today's Transactions
    const todaysTransactions = await PaymentSummaryService.getTodayTransactionSummary();

    res.render('admin/repayments', {
      title: 'Repayments & Portfolio Management',
      searchId,
      success: req.query.success,
      summary,
      portfolio,
      todaysTransactions,
      currentFrequency: frequency,
      currentStatus: status,
      
      // Keep existing data structure for backwards compatibility if needed by modal
      loan: loanDetails ? loanDetails.loan : null,
      customer: loanDetails ? loanDetails.customer : null,
      installments: loanDetails ? loanDetails.installments : [],
      nextEmi: loanDetails ? loanDetails.nextEmi : null,
      totalPaid: loanDetails ? loanDetails.totalPaid : 0,
      payments: loanDetails ? loanDetails.payments : recentPayments,
      recentPayments,
      formatINR,
      formatDate
    });
  } catch (err) {
    next(err);
  }
};

/**
 * API Search endpoint: GET /admin/repayments/search?q=...
 * Search customer loans by Loan ID, Loan Number, Customer Name, Customer Code, or Mobile Number.
 */
export const searchLoan = async (req, res, next) => {
  try {
    const q = req.query.q || req.query.loanId || '';
    if (!q || q.trim() === '') {
      return res.json({ success: true, data: [] });
    }

    const results = await paymentModel.searchLoan(db, q);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * API Details endpoint: GET /admin/repayments/:loanId
 * Fetch full details for a loan including installments schedule and payment history.
 */
export const getLoanDetails = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const details = await paymentModel.getLoanDetails(db, loanId);

    if (!details) {
      return res.status(404).json({ success: false, message: 'Loan record not found' });
    }

    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record payment endpoint: POST /admin/repayments
 * Process loan repayment within database transaction.
 */
export const recordPayment = async (req, res, next) => {
  try {
    const {
      loanId,
      loan_id,
      amount,
      payment_amount,
      paymentMethod,
      payment_method,
      transactionReference,
      transaction_reference,
      referenceNumber,
      reference_number,
      paymentDate,
      payment_date,
      remarks
    } = req.body;

    const targetLoanId = loanId || loan_id;
    const numericAmount = parseFloat(amount || payment_amount);
    const method = (paymentMethod || payment_method || '').toUpperCase();
    const refNumber = referenceNumber || reference_number || transactionReference || transaction_reference || '';
    
    const inputDateStr = paymentDate || payment_date;
    let dateToSave = new Date();
    if (inputDateStr) {
      const now = new Date();
      const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      if (inputDateStr !== todayStr) {
        dateToSave = new Date(`${inputDateStr}T12:00:00`);
      }
    }

    // Validation Rules
    if (!targetLoanId) {
      return res.status(400).json({ success: false, message: 'Loan ID is required' });
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid payment amount greater than ₹0' });
    }

    const validMethods = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];
    if (!method || !validMethods.includes(method)) {
      return res.status(400).json({ success: false, message: 'Please select a valid payment method (CASH, UPI, BANK_TRANSFER, CHEQUE)' });
    }

    if (method !== 'CASH' && (!refNumber || refNumber.trim() === '')) {
      return res.status(400).json({ success: false, message: `Transaction Reference Number is required for ${method} payments` });
    }

    const adminId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;

    const result = await paymentModel.recordPayment(db, {
      loan_id: targetLoanId,
      amount: numericAmount,
      payment_method: method,
      reference_number: refNumber || `TXN${Date.now()}`,
      payment_date: dateToSave,
      remarks,
      admin_id: adminId
    });

    const updatedDetails = await paymentModel.getLoanDetails(db, targetLoanId);
    const isJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.headers['content-type'] === 'application/json';

    if (isJson) {
      return res.status(200).json({
        success: true,
        message: result.isClosed 
          ? `✓ Payment of ₹${numericAmount.toLocaleString('en-IN')} recorded successfully! Loan balance is ₹0 and loan is now CLOSED.` 
          : `✓ Payment of ₹${numericAmount.toLocaleString('en-IN')} recorded successfully`,
        updatedLoan: updatedDetails ? updatedDetails.loan : null,
        data: result
      });
    } else {
      return res.redirect(`/admin/repayments?loanId=${targetLoanId}&success=1`);
    }
  } catch (error) {
    const isJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (isJson) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Additional helpers
 */
export const getAllPayments = async (req, res, next) => {
  try {
    const payments = await paymentModel.getAllPayments(db);
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentModel.getPaymentById(db, req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const getPaymentsByLoan = async (req, res, next) => {
  try {
    const payments = await paymentModel.getPaymentsByLoan(db, req.params.loanId);
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};

export const getPaymentsByCustomer = async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const payments = await paymentModel.getPaymentsByCustomer(db, customerId);
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};
