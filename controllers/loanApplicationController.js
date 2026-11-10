import logger from '../utils/logger.js';
import db from '../config/db.js';
import * as loanAppModel from '../models/loanApplicationModel.js';

export const getAllApplications = async (req, res, next) => {
  try {
    const apps = await loanAppModel.getAllApplications(db);
    res.json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

export const getApplicationById = async (req, res, next) => {
  try {
    const app = await loanAppModel.getApplicationById(db, req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

export const createApplication = async (req, res, next) => {
  try {
    // Note: Assuming authMiddleware sets req.user
    // Find customer_id for this user.
    const [profiles] = await db.query('SELECT id FROM customer_profiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer profile not found' });
    }
    const customer_id = profiles[0].id;

    // Check for existing pending applications
    const [existingApps] = await db.query(
      "SELECT id FROM loan_applications WHERE customer_id = ? AND application_status IN ('PENDING', 'UNDER_REVIEW')", 
      [customer_id]
    );
    if (existingApps.length > 0) {
      const msg = 'You already have a pending loan application. Please wait for it to be processed before applying for a new one.';
      return res.status(400).json({ success: false, message: msg });
    }

    // Update customer profile with the new data from the form
    if (req.body.full_name || req.body.phone || req.body.pan_number || req.body.occupation || req.body.address) {
      await db.query(
        'UPDATE customer_profiles SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), pan_number = COALESCE(?, pan_number), occupation = COALESCE(?, occupation), address = COALESCE(?, address) WHERE id = ?',
        [req.body.full_name, req.body.phone, req.body.pan_number, req.body.occupation, req.body.address, customer_id]
      );
    }

    const appData = {
      customer_id,
      application_number: `APP${Date.now().toString().slice(-6)}`,
      application_status: 'PENDING',
      requested_amount: req.body.requested_amount,
      monthly_income: req.body.monthly_income,
      loan_type_id: req.body.loan_type_id,
      requested_duration_months: req.body.requested_duration_months,
      purpose: req.body.loan_purpose
    };

    const newAppId = await loanAppModel.createApplication(db, appData);
    res.status(201).json({ success: true, message: 'Application created successfully', data: appData });
  } catch (error) {
    logger.error("LOAN APPLICATION SUBMIT ERROR:", error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || (error.message && error.message.includes('ER_NO_REFERENCED_ROW_2'))) {
      const msg = "Invalid selection. Please choose a valid Loan Type.";
      return res.status(400).json({ success: false, message: msg });
    }
    // Handle error in a user-friendly way instead of leaking DB errors
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while processing your application. Please verify your inputs and try again.' });
  }
};

import LoanSchemeAssignmentService from '../services/loanSchemeAssignmentService.js';

export const approveApplication = async (req, res, next) => {
  try {
    const isJson = req.headers.accept?.includes('application/json') ||
                   req.headers['content-type']?.includes('application/json');

    const appId   = req.params.id;
    const adminId = (res.locals.user || req.user).id;
    const adminRole = (res.locals.user || req.user).role;
    const { approvedAmount, scheme_id, interestAmount, flatInterestAmount, durationValue } = req.body;

    // ── Validate application exists and is actionable ────────
    const [appCheck] = await db.query(
      'SELECT application_status, application_number, customer_id, loan_type_id FROM loan_applications WHERE id = ? FOR UPDATE',
      [appId]
    );
    if (appCheck.length === 0) {
      if (isJson) return res.status(404).json({ success: false, message: 'Application not found' });
      return res.status(404).send('Application not found');
    }

    const currentStatus = (appCheck[0].application_status || '').toUpperCase();
    if (currentStatus !== 'PENDING' && currentStatus !== 'UNDER_REVIEW') {
      const msg = `This loan application has already been processed (Status: ${currentStatus}).`;
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    // ── Validate Approved Amount ─────────────────────────────
    const numApprovedAmount = Math.round(parseFloat(approvedAmount) * 100) / 100;
    if (isNaN(numApprovedAmount) || numApprovedAmount <= 0) {
      const msg = 'Approved principal amount must be greater than zero.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    // ── Validate Scheme (server-side — do NOT trust browser values) ──
    if (!scheme_id) {
      const msg = 'A Loan Scheme must be selected before approving.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    const [schemeRows] = await db.query(
      "SELECT id, scheme_name, base_interest_rate, base_interest_amount, duration_value, repayment_frequency, status FROM loan_schemes WHERE id = ?",
      [scheme_id]
    );
    if (schemeRows.length === 0) {
      const msg = 'Selected loan scheme does not exist.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }
    if (schemeRows[0].status !== 'ACTIVE') {
      const msg = `Selected scheme "${schemeRows[0].scheme_name}" is not active and cannot be used.`;
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    const scheme = schemeRows[0];

    // ── Validate Flat Interest Amount (Non-negative, max 2 decimals) ──
    const rawInterest = (interestAmount !== undefined && interestAmount !== null && interestAmount !== '')
      ? interestAmount
      : ((flatInterestAmount !== undefined && flatInterestAmount !== null && flatInterestAmount !== '')
          ? flatInterestAmount
          : (req.body.interest_amount !== undefined ? req.body.interest_amount : (scheme.base_interest_amount || 0)));

    const numInterest = parseFloat(rawInterest);
    if (isNaN(numInterest) || numInterest < 0) {
      const msg = 'Final interest amount must be a valid non-negative amount (₹0 or greater).';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    const decimalPart = rawInterest.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      const msg = 'Final interest amount cannot exceed 2 decimal places.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    const finalFlatInterest = Math.round(numInterest * 100) / 100;
    const exactTotalPayable = Math.round((numApprovedAmount + finalFlatInterest) * 100) / 100;
    const finalTotalPayable = Math.ceil(exactTotalPayable);
    const roundingAdjustment = Math.round((finalTotalPayable - exactTotalPayable) * 100) / 100;

    if (finalTotalPayable <= 0) {
      const msg = 'Total payable amount must be greater than zero.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    // ── Validate Final Duration ──────────────────────────────
    let finalDuration = parseInt(durationValue || scheme.duration_value, 10);
    if (isNaN(finalDuration) || finalDuration <= 0) {
      const msg = 'Final duration must be a valid positive integer.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${appId}?error=${encodeURIComponent(msg)}`);
    }

    // ── Execute Approval in Transaction ──────────────
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Update Application Status and Terms
      await connection.query(
        `UPDATE loan_applications SET 
          application_status = 'APPROVED', 
          reviewed_by = ?,
          reviewed_at = NOW(),
          loan_scheme_id = ?,
          requested_amount = ?,
          requested_interest_rate = 0.00,
          requested_duration_months = ?,
          approved_principal = ?,
          approved_interest_amount = ?,
          approved_rounding_adjustment = ?,
          approved_total_payable = ?,
          interest_calculation_method = 'FLAT_AMOUNT'
         WHERE id = ?`,
        [
          adminId,
          scheme.id,
          numApprovedAmount,
          finalDuration,
          numApprovedAmount,
          finalFlatInterest,
          roundingAdjustment,
          finalTotalPayable,
          appId
        ]
      );

      // 2. Audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, module_name, entity_name, action, description, ip_address)
         VALUES (?, 'APPLICATIONS', 'loan_applications', 'APPROVE', ?, ?)`,
        [
          adminId,
          `${adminRole} approved loan application #${appCheck[0].application_number} with scheme "${scheme.scheme_name}" (Principal: ₹${numApprovedAmount}, Flat Interest: ₹${finalFlatInterest}, Rounding Adj: ₹${roundingAdjustment}, Total Payable: ₹${finalTotalPayable})`,
          req.ip || req.connection?.remoteAddress || 'unknown',
        ]
      );

      await connection.commit();

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    // ── Notification ─────────────────────────────────────────
    try {
      const [appRows] = await db.query(`
        SELECT a.application_number, c.user_id, u.email
        FROM loan_applications a
        JOIN customer_profiles c ON a.customer_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE a.id = ?
      `, [appId]);
      if (appRows.length > 0) {
        const { application_number, user_id, email } = appRows[0];
        const notificationService = (await import('../services/notificationService.js')).default;
        await notificationService.sendLoanApproved({ id: user_id, email }, application_number);
      }
    } catch (notifErr) {
      logger.error('[Notify] Failed to send approval notification:', notifErr.message);
    }

    if (isJson) {
      return res.json({ success: true, message: 'Application approved successfully' });
    }
    return res.redirect(`/admin/applications/${appId}?success=Application+approved+successfully`);

  } catch (error) {
    if (
      error.sqlState === '45000' ||
      error.errno   === 1644 ||
      (error.sqlMessage && error.sqlMessage.includes('not pending'))
    ) {
      const isJson = req.headers.accept?.includes('application/json');
      const msg = 'This loan application has already been processed and is no longer pending review.';
      if (isJson) return res.status(400).json({ success: false, message: msg });
      return res.redirect(`/admin/applications/${req.params.id}?error=${encodeURIComponent(msg)}`);
    }
    logger.error('[approveApplication] Unexpected error:', error.message);
    next(error);
  }
};
export const rejectApplication = async (req, res, next) => {
  try {
    // Authorization verified by requirePermission('applications.reject') middleware.
    const appId    = req.params.id;
    const adminId  = (res.locals.user || req.user).id;
    const adminRole = (res.locals.user || req.user).role;
    const { remarks } = req.body;

    // ── Validate remarks ──────────────────────────────────────
    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason (remarks) is required.',
      });
    }

    // ── Validate application ─────────────────────────────────
    const [app] = await db.query(
      'SELECT id, application_status, application_number FROM loan_applications WHERE id = ?',
      [appId]
    );
    if (app.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (app[0].application_status !== 'PENDING' && app[0].application_status !== 'UNDER_REVIEW') {
      return res.status(400).json({
        success: false,
        message: 'Application cannot be rejected in its current state.',
      });
    }

    // ── Reject ───────────────────────────────────────────────
    await db.query(
      `UPDATE loan_applications
       SET application_status = 'REJECTED',
           admin_remarks       = ?,
           reviewed_by         = ?,
           reviewed_at         = NOW()
       WHERE id = ?`,
      [remarks.trim(), adminId, appId]
    );

    // ── Audit log ────────────────────────────────────────────
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, module_name, entity_name, action, description, ip_address)
         VALUES (?, 'APPLICATIONS', 'loan_applications', 'REJECT', ?, ?)`,
        [
          adminId,
          `${adminRole} rejected loan application #${app[0].application_number} (app_id=${appId}). Reason: ${remarks.trim().substring(0, 120)}`,
          req.ip || req.connection?.remoteAddress || 'unknown',
        ]
      );
    } catch (auditErr) {
      logger.error('[Audit] Failed to log rejection:', auditErr.message);
    }

    const isJson = req.headers.accept?.includes('application/json') ||
                   req.headers['content-type']?.includes('application/json');
    if (isJson) {
      return res.json({ success: true, message: 'Application rejected successfully.' });
    }
    return res.redirect('/admin/applications');

  } catch (error) {
    next(error);
  }
};
