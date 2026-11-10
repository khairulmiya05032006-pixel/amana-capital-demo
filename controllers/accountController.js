import db from '../config/db.js';
import * as accountModel from '../models/accountModel.js';
import { createObjectCsvStringifier } from 'csv-writer';

/**
 * Account Controller - Handles Admin Treasury Account & Lending Capital Top Up
 */

/**
 * Render main Admin Account Page (GET /admin/account)
 */
export const showAccount = async (req, res, next) => {
  try {
    const accountData = await accountModel.getAccount(db);
    const transactions = await accountModel.getTransactions(db, 100);

    const formatINR = (value) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(value || 0);

    const formatDate = (dateString) =>
      dateString ? new Date(dateString).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    res.render('admin/account', {
      title: 'Admin Account & Lending Capital',
      balance: accountData.balance,
      available_balance: accountData.balance,
      totalDeposits: accountData.totalDeposits,
      thisMonthDeposits: accountData.thisMonthDeposits,
      totalTransactions: accountData.totalTransactions,
      totalDisbursed: accountData.totalDisbursed,
      totalCollected: accountData.totalCollected,
      transactions,
      success: req.query.success ? 'Operational lending funds added successfully!' : null,
      error: null,
      formatINR,
      formatDate
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add Funds / Top Up Lending Capital (POST /admin/account/add-funds)
 */
export const addFunds = async (req, res, next) => {
  try {
    const {
      amount,
      fundingSource,
      funding_source,
      paymentMethod,
      payment_method,
      referenceNumber,
      reference_number,
      reference,
      depositDate,
      deposit_date,
      description
    } = req.body;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
      if (isJson) {
        return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount greater than ₹0' });
      }
      return res.render('admin/account', {
        title: 'Admin Account & Lending Capital',
        error: 'Please enter a valid deposit amount greater than ₹0'
      });
    }

    const method = (paymentMethod || payment_method || 'CASH').toUpperCase();
    const source = fundingSource || funding_source || 'Owner Investment';
    const refNum = referenceNumber || reference_number || reference || '';

    if (method !== 'CASH' && (!refNum || refNum.trim() === '')) {
      const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type'] === 'application/json';
      if (isJson) {
        return res.status(400).json({ success: false, message: `Transaction Reference Number is required for ${method} deposits` });
      }
    }

    const adminId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await accountModel.addFunds(db, {
      amount: numericAmount,
      fundingSource: source,
      paymentMethod: method,
      referenceNumber: refNum,
      depositDate: depositDate || deposit_date || new Date().toISOString().split('T')[0],
      description,
      adminId,
      ipAddress
    });

    const isJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.headers['content-type'] === 'application/json';

    if (isJson) {
      return res.status(200).json({
        success: true,
        message: `✓ ₹${numericAmount.toLocaleString('en-IN')} added to available lending capital successfully!`,
        newBalance: result.newBalance,
        data: result
      });
    } else {
      return res.redirect('/admin/account?success=1');
    }
  } catch (error) {
    const isJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.headers['content-type'] === 'application/json';
    if (isJson) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Get Account Transactions JSON API (GET /admin/account/transactions)
 */
export const getTransactions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const transactions = await accountModel.getTransactions(db, limit);
    const accountData = await accountModel.getAccount(db);

    res.json({
      success: true,
      balance: accountData.balance,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Transactions as CSV (GET /admin/account/transactions/export)
 */
export const exportTransactionsCSV = async (req, res, next) => {
  try {
    const transactions = await accountModel.getTransactions(db, 100);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'transaction_id', title: 'Transaction ID' },
        { id: 'date', title: 'Date' },
        { id: 'type', title: 'Type' },
        { id: 'amount', title: 'Amount' },
        { id: 'source', title: 'Source/Destination' },
        { id: 'method', title: 'Method' },
        { id: 'reference', title: 'Reference No.' },
        { id: 'description', title: 'Description' }
      ]
    });

    const records = transactions.reverse().map(t => ({
      transaction_id: t.id,
      date: t.created_at ? new Date(t.created_at).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
      type: t.transaction_type,
      amount: t.amount,
      source: t.funding_source || (t.description ? t.description.slice(0, 30) : 'General Fund'),
      method: (t.payment_method || 'CASH').replace('_', ' '),
      reference: t.reference_number || t.reference || 'N/A',
      description: t.description || ''
    }));

    const csvHeader = csvStringifier.getHeaderString();
    const csvRecords = csvStringifier.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="treasury_transactions.csv"');
    res.status(200).send(csvHeader + csvRecords);
  } catch (error) {
    next(error);
  }
};
