import db from '../config/db.js';

export const getDashboardReport = async (req, res, next) => {
  try {
    const [stats] = await db.query('SELECT COUNT(*) as loans, SUM(principal_amount) as total FROM loans');
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    next(error);
  }
};

export const getOverdueLoansReport = async (req, res, next) => {
  try {
    const [overdue] = await db.query(`
      SELECT l.*, i.due_date, i.emi_amount
      FROM loans l
      JOIN loan_installments i ON l.id = i.loan_id
      WHERE i.status = 'PENDING' AND i.due_date < CURDATE()
    `);
    res.json({ success: true, data: overdue });
  } catch (error) {
    next(error);
  }
};

export const getCollectionReport = async (req, res, next) => {
  try {
    const [collections] = await db.query(`
      SELECT collected_by, SUM(payment_amount) as total_collected
      FROM payments
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY collected_by
    `);
    res.json({ success: true, data: collections });
  } catch (error) {
    next(error);
  }
};

export const getCustomerSummaryReport = async (req, res, next) => {
  try {
    const [summary] = await db.query(`
      SELECT customer_id, COUNT(*) as loan_count, SUM(principal_amount) as total_loans
      FROM loans
      GROUP BY customer_id
    `);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const generateMonthlyReport = async (req, res, next) => {
  try {
    const [report] = await db.query(`
      SELECT 
        DATE_FORMAT(disbursement_date, '%Y-%m') as month,
        COUNT(*) as total_loans_issued,
        SUM(principal_amount) as total_principal_issued
      FROM loans
      GROUP BY month
      ORDER BY month DESC
    `);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const getAdminReportsDashboard = async (req, res, next) => {
  try {
    const [monthlyCollections] = await db.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%b %Y') AS collection_month,
        COALESCE(SUM(payment_amount), 0) AS total_collected,
        COUNT(id) AS number_of_payments
      FROM payments
      WHERE payment_status = 'SUCCESS'
      GROUP BY DATE_FORMAT(payment_date, '%b %Y'), DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY DATE_FORMAT(payment_date, '%Y-%m') DESC
      LIMIT 12
    `);
    const [overdueLoans] = await db.query(`
      SELECT 
        l.id as loan_id, 
        l.loan_number, 
        c.full_name as customer_name, 
        c.phone as customer_phone, 
        COUNT(li.id) as installment_count, 
        MIN(li.due_date) as due_date, 
        SUM(li.total_amount) as installment_amount, 
        SUM(li.penalty_amount) as penalty_amount, 
        SUM(li.total_amount + li.penalty_amount - li.paid_amount) as amount_due, 
        DATEDIFF(CURRENT_DATE(), MIN(li.due_date)) as days_overdue 
      FROM loan_installments li
      JOIN loans l ON li.loan_id = l.id
      JOIN customer_profiles c ON l.customer_id = c.id
      WHERE li.installment_status = 'OVERDUE'
      GROUP BY l.id, l.loan_number, c.full_name, c.phone 
      ORDER BY due_date ASC 
      LIMIT 100
    `);
    
    // Fetch last 20 audit logs with user info if available
    const [auditLogs] = await db.query(`
      SELECT a.*, u.email as admin_email 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC 
      LIMIT 20
    `);

    res.json({ success: true, monthlyCollections, overdueLoans, auditLogs });
  } catch (error) {
    next(error);
  }
};

import { createObjectCsvStringifier } from 'csv-writer';

export const exportCollectionsCSV = async (req, res, next) => {
  try {
    const [monthlyCollections] = await db.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%b %Y') AS collection_month,
        COALESCE(SUM(payment_amount), 0) AS total_collected,
        COUNT(id) AS number_of_payments
      FROM payments
      WHERE payment_status = 'SUCCESS'
      GROUP BY DATE_FORMAT(payment_date, '%b %Y'), DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY DATE_FORMAT(payment_date, '%Y-%m') DESC
    `);
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'collection_month', title: 'Month' },
        { id: 'total_collected', title: 'Total Collected (INR)' },
        { id: 'number_of_payments', title: 'Number of Payments' }
      ]
    });

    const header = csvStringifier.getHeaderString();
    const records = csvStringifier.stringifyRecords(monthlyCollections);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_collections.csv"');
    res.send(header + records);
  } catch (error) {
    next(error);
  }
};

export const exportOverdueCSV = async (req, res, next) => {
  try {
    const [overdueLoans] = await db.query(`
      SELECT 
        l.id as loan_id, 
        l.loan_number, 
        c.full_name as customer_name, 
        c.phone as customer_phone, 
        COUNT(li.id) as installment_count, 
        MIN(li.due_date) as due_date, 
        SUM(li.total_amount) as installment_amount, 
        SUM(li.penalty_amount) as penalty_amount, 
        SUM(li.total_amount + li.penalty_amount - li.paid_amount) as amount_due, 
        DATEDIFF(CURRENT_DATE(), MIN(li.due_date)) as days_overdue 
      FROM loan_installments li
      JOIN loans l ON li.loan_id = l.id
      JOIN customer_profiles c ON l.customer_id = c.id
      WHERE li.installment_status = 'OVERDUE'
      GROUP BY l.id, l.loan_number, c.full_name, c.phone 
      ORDER BY due_date ASC
    `);
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'loan_number', title: 'Loan Reference' },
        { id: 'customer_name', title: 'Borrower Name' },
        { id: 'customer_phone', title: 'Phone Number' },
        { id: 'due_date', title: 'Oldest Due Date' },
        { id: 'installment_count', title: 'Overdue Installments' },
        { id: 'installment_amount', title: 'Amount Due (INR)' },
        { id: 'penalty_amount', title: 'Penalty (INR)' },
        { id: 'amount_due', title: 'Total Due (INR)' }
      ]
    });

    // Format dates before passing to csv-writer
    const formattedData = overdueLoans.map(row => ({
      ...row,
      due_date: new Date(row.due_date).toLocaleDateString('en-IN')
    }));

    const header = csvStringifier.getHeaderString();
    const records = csvStringifier.stringifyRecords(formattedData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="overdue_loans.csv"');
    res.send(header + records);
  } catch (error) {
    next(error);
  }
};
