import db from '../config/db.js';
import * as settingsModel from '../models/settingsModel.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const [[{ total_customers }]] = await db.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'CUSTOMER'");
    const [[{ active_loans }]] = await db.query("SELECT COUNT(*) AS active_loans FROM loans WHERE loan_status = 'ACTIVE'");
    const [[{ total_money_lent }]] = await db.query("SELECT COALESCE(SUM(principal_amount), 0) AS total_money_lent FROM loans WHERE loan_status IN ('ACTIVE', 'CLOSED', 'COMPLETED', 'DEFAULTED')");
    const [[{ approved_loans }]] = await db.query("SELECT COUNT(*) AS approved_loans FROM loan_applications WHERE application_status = 'APPROVED'");
    const [[{ todays_collections }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS todays_collections FROM payments WHERE DATE(payment_date) = CURDATE() AND payment_status = 'SUCCESS'");
    const [[{ total_repayments_received }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS total_repayments_received FROM payments WHERE payment_status = 'SUCCESS'");
    const [[{ outstanding_balance }]] = await db.query("SELECT COALESCE(SUM(outstanding_balance), 0) AS outstanding_balance FROM loans WHERE loan_status = 'ACTIVE'");
    const [[{ overdue_amount }]] = await db.query("SELECT COALESCE(SUM(total_amount + penalty_amount - paid_amount), 0) AS overdue_amount FROM loan_installments WHERE installment_status = 'OVERDUE'");
    const [[{ closed_loans }]] = await db.query("SELECT COUNT(*) AS closed_loans FROM loans WHERE loan_status = 'CLOSED'");

    const summary = {
      total_customers,
      active_loans,
      total_money_lent,
      approved_loans,
      todays_collections,
      total_repayments_received,
      outstanding_balance,
      overdue_amount,
      closed_loans
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getOverdueLoans = async (req, res, next) => {
  try {
    const [loans] = await db.query(`
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
    res.json({ success: true, data: loans });
  } catch (error) {
    next(error);
  }
};

export const getPendingApplications = async (req, res, next) => {
  try {
    const [applications] = await db.query(`
      SELECT a.*, c.full_name, c.customer_code, c.phone
      FROM loan_applications a
      JOIN customer_profiles c ON a.customer_id = c.id
      WHERE a.application_status = 'PENDING'
      ORDER BY a.created_at ASC
    `);
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
};

export const getApplicationDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [applications] = await db.query(`
      SELECT a.*, c.full_name, c.customer_code, c.phone, c.aadhaar_number, c.pan_number, c.address, c.monthly_income, c.occupation
      FROM loan_applications a
      JOIN customer_profiles c ON a.customer_id = c.id
      WHERE a.id = ?
    `, [id]);
    
    if (applications.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    res.json({ success: true, data: applications[0] });
  } catch (error) {
    next(error);
  }
};

export const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsModel.getSettings(db);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { section = 'general', ...formData } = req.body;
    const userId = req.user?.id || 1;
    const ipAddress = req.ip || '127.0.0.1';

    const result = await settingsModel.updateSettings(db, section, formData, userId, ipAddress);
    res.json({ success: true, message: 'Settings updated successfully.', data: result });
  } catch (error) {
    next(error);
  }
};
