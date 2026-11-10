import db from '../config/db.js';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';
import * as loanAppModel from '../models/loanApplicationModel.js';
import { validationResult } from 'express-validator';
import CustomerRepaymentPortfolioService from '../services/customerRepaymentPortfolioService.js';
import { checkDeletionEligibility } from '../services/customerDeletionService.js';

// 1. List Customers with Search and Frequency Filter
export const listCustomers = async (req, res, next) => {
  try {
    const search = req.query.q || '';
    const frequency = req.query.frequency || 'ALL';

    const customers = await CustomerRepaymentPortfolioService.getCustomerPortfolio({ q: search, frequency });
    const summary = await CustomerRepaymentPortfolioService.getPortfolioSummary();

    const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

    res.render('admin/customers/index', {
      title: 'Customer Management',
      customers,
      summary,
      searchQuery: search,
      currentFrequency: frequency,
      formatINR,
      formatDate
    });
  } catch (err) {
    next(err);
  }
};

// 2. Show Add Form
export const showCreateForm = (req, res) => {
  res.render('admin/customers/register', {
    title: 'Register New Customer',
    customer: {}, // Empty for new
    error: null
  });
};

// 3. Process Add Customer
export const createCustomer = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { 
      full_name, email, phone, password, confirm_password
    } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'Email address is required.' });
    }
    if (!phone || !phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'A valid 10-digit mobile number is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'Password does not meet the required security policy (min 8 characters).' });
    }
    if (password !== confirm_password) {
      return res.status(400).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'Passwords do not match.' });
    }

    await connection.beginTransaction();

    // Check if email already exists
    const [existingUsers] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'An account with this email already exists.' });
    }

    // Check if phone already exists
    const [existingPhones] = await connection.query('SELECT id FROM customer_profiles WHERE phone = ?', [phone.trim()]);
    if (existingPhones.length > 0) {
      await connection.rollback();
      return res.status(409).render('admin/customers/register', { title: 'Register New Customer', customer: req.body, error: 'An account with this phone number already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user_code = `US${Date.now().toString().slice(-6)}`;

    const [userResult] = await connection.query(
      'INSERT INTO users (user_code, email, password_hash, role, force_password_change) VALUES (?, ?, ?, ?, ?)',
      [user_code, email.toLowerCase(), password_hash, 'CUSTOMER', false]
    );

    const [profileResult] = await connection.query(
      `INSERT INTO customer_profiles 
      (user_id, customer_code, full_name, phone) 
      VALUES (?, ?, ?, ?)`,
      [userResult.insertId, 'TEMP', full_name.trim(), phone.trim()]
    );

    const profileId = profileResult.insertId;
    const customer_code = `CUS${profileId.toString().padStart(5, '0')}`;

    // Update with the correct customer_code
    await connection.query(
      'UPDATE customer_profiles SET customer_code = ? WHERE id = ?',
      [customer_code, profileId]
    );

    await connection.commit();

    // Audit log: Customer created
    const adminId = (req?.user?.id) || (res?.locals?.user?.id) || null;
    await connection.query(
      `INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, created_at)
       VALUES (?, 'CUSTOMERS', 'customer_profiles', ?, 'CUSTOMER_CREATED', ?, NOW())`,
      [adminId, profileId, `Admin created customer account '${full_name}' (${email})`]
    );

    res.redirect('/admin/customers?success=The customer account has been created successfully. The customer can now log in using the registered email and password.');
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

// 4. Show Edit Form
export const showEditForm = async (req, res, next) => {
  try {
    const { id } = req.params; // customer_profiles.id
    const [rows] = await db.query(`
      SELECT c.*, u.email 
      FROM customer_profiles c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).send('Customer not found');
    
    // Format date for HTML date input (YYYY-MM-DD)
    const customer = rows[0];
    if (customer.date_of_birth) {
      customer.date_of_birth = new Date(customer.date_of_birth).toISOString().split('T')[0];
    }

    res.render('admin/customers/form', {
      title: 'Edit Customer',
      customer,
      error: null
    });
  } catch (err) {
    next(err);
  }
};

// 5. Process Edit Form
export const updateCustomer = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { 
      full_name, email, phone, date_of_birth, gender, 
      address, occupation, monthly_income, aadhaar_number, pan_number 
    } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('admin/customers/form', { 
        title: 'Edit Customer', 
        customer: { ...req.body, id }, 
        errors: errors.mapped(),
        error: null
      });
    }

    // First find the user_id for this customer
    const [profiles] = await connection.query('SELECT user_id FROM customer_profiles WHERE id = ?', [id]);
    if (profiles.length === 0) return res.status(404).send('Customer not found');
    const userId = profiles[0].user_id;

    await connection.beginTransaction();

    await connection.query(
      `UPDATE users SET email = ? WHERE id = ?`,
      [email, userId]
    );

    await connection.query(
      `UPDATE customer_profiles 
       SET full_name=?, phone=?, date_of_birth=?, gender=?, address=?, occupation=?, monthly_income=?, aadhaar_number=?, pan_number=?
       WHERE id=?`,
      [full_name, phone, date_of_birth || null, gender || null, address || null, occupation || null, monthly_income || 0, aadhaar_number || null, pan_number || null, id]
    );

    await connection.commit();

    // Audit log: Customer updated
    const adminId = (req?.user?.id) || (res?.locals?.user?.id) || null;
    await connection.query(
      `INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, created_at)
       VALUES (?, 'CUSTOMERS', 'customer_profiles', ?, 'UPDATE', ?, NOW())`,
      [adminId, id, `Admin updated customer profile ID #${id}`]
    );

    res.redirect(`/admin/customers/${id}`);
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      let duplicateField = 'A field';
      if (error.sqlMessage.includes('uk_customer_aadhaar')) duplicateField = 'Aadhaar number';
      else if (error.sqlMessage.includes('uk_customer_pan')) duplicateField = 'PAN number';
      else if (error.sqlMessage.includes('uk_customer_phone') || error.sqlMessage.includes('phone')) duplicateField = 'Phone number';
      else if (error.sqlMessage.includes('uk_users_email') || error.sqlMessage.includes('email')) duplicateField = 'Email';
      return res.render('admin/customers/form', { title: 'Edit Customer', customer: { ...req.body, id: req.params.id }, error: `${duplicateField} is already registered by another customer.` });
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

// 6. View Details
export const showCustomerDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [customerRows] = await db.query(`
      SELECT c.*, u.email, u.account_status,
             (SELECT COUNT(*) FROM loan_applications la WHERE la.customer_id = c.id AND la.application_status IN ('PENDING', 'UNDER_REVIEW')) as pending_apps
      FROM customer_profiles c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `, [id]);

    if (customerRows.length === 0) return res.status(404).send('Customer not found');
    const customer = customerRows[0];

    // Fetch Loans
    const [loans] = await db.query(`
      SELECT l.*, COALESCE(ls.scheme_name, t.loan_name) as type_name 
      FROM loans l 
      LEFT JOIN loan_schemes ls ON l.loan_type_id = ls.id
      LEFT JOIN loan_types t ON l.loan_type_id = t.id 
      WHERE l.customer_id = ? 
      ORDER BY l.created_at DESC
    `, [id]);

    const [payments] = await db.query(`
      SELECT p.*, l.loan_number 
      FROM payments p 
      JOIN loans l ON p.loan_id = l.id 
      WHERE p.customer_id = ? 
      ORDER BY p.payment_date DESC
    `, [id]);

    const [installments] = await db.query(`
      SELECT i.*, l.loan_number
      FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      WHERE l.customer_id = ?
      ORDER BY i.due_date ASC
    `, [id]);

    const activeLoansCount = loans.filter(l => l.loan_status === 'ACTIVE').length;
    const closedLoansCount = loans.filter(l => l.loan_status === 'CLOSED').length;
    const totalRepaid = payments.reduce((sum, p) => sum + parseFloat(p.payment_amount || 0), 0);
    const totalBorrowed = loans.reduce((sum, l) => sum + parseFloat(l.principal_amount || 0), 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + parseFloat(l.outstanding_balance || 0), 0);

    const [loanApps] = await db.query(`SELECT COUNT(*) as count FROM loan_applications WHERE customer_id = ?`, [id]);
    const applicationsCount = loanApps[0].count;
    
    // Determine Deletion Eligibility
    const deletionEligibilityCheck = await checkDeletionEligibility(id, db);
    const deletionEligibility = {
      allowed: deletionEligibilityCheck.canDelete,
      reason: deletionEligibilityCheck.reason,
      state: deletionEligibilityCheck.customerState
    };

    const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

    res.render('admin/customers/details', {
      title: 'Customer Details',
      customer,
      loans,
      payments,
      installments,
      activeLoansCount,
      closedLoansCount,
      totalRepaid,
      totalBorrowed,
      applicationsCount,
      deletionEligibility,
      totalOutstanding,
      formatINR,
      formatDate
    });
  } catch (err) {
    next(err);
  }
};

// 7. Permanently Delete Customer
export const deleteCustomer = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    
    await connection.beginTransaction();

    // 1. Fetch and Lock customer record
    const [profiles] = await connection.query('SELECT id, user_id, customer_code, full_name FROM customer_profiles WHERE id = ? FOR UPDATE', [id]);
    if (profiles.length === 0) {
      await connection.rollback();
      return res.status(404).send("Customer not found.");
    }
    const customer = profiles[0];

    // 2. Enforce Financial Safety Rules inside transaction
    const eligibility = await checkDeletionEligibility(id, connection);
    if (!eligibility.canDelete) {
      await connection.rollback();
      return res.status(400).send(eligibility.reason);
    }

    // Determine if loans exist to delete installments/penalties
    const [loans] = await connection.query('SELECT id FROM loans WHERE customer_id = ?', [id]);

    // 3. Delete financial history
    await connection.query('DELETE FROM loan_transactions WHERE customer_id = ?', [id]);
    await connection.query('DELETE FROM payments WHERE customer_id = ?', [id]);
    
    if (loans.length > 0) {
      await connection.query('DELETE FROM penalties WHERE loan_id IN (SELECT id FROM loans WHERE customer_id = ?)', [id]);
      await connection.query('DELETE FROM loan_installments WHERE loan_id IN (SELECT id FROM loans WHERE customer_id = ?)', [id]);
    }
    
    await connection.query('DELETE FROM loans WHERE customer_id = ?', [id]);
    await connection.query('DELETE FROM loan_applications WHERE customer_id = ?', [id]);

    // 4. Delete profile and user (audit_logs uses ON DELETE SET NULL to preserve immutable history)
    await connection.query('DELETE FROM customer_profiles WHERE id = ?', [id]);
    await connection.query('DELETE FROM users WHERE id = ?', [customer.user_id]);

    // 5. Audit Log (Preserved, ON DELETE SET NULL on user_id)
    const adminId = (req?.user?.id) || (res?.locals?.user?.id) || null;
    await connection.query(
      `INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, created_at)
       VALUES (?, 'CUSTOMERS', 'users', ?, 'DELETE', ?, NOW())`,
      [adminId, customer.user_id, `CUSTOMER_DELETED: Admin deleted customer ${customer.full_name} (${customer.customer_code})`]
    );

    await connection.commit();
    res.redirect('/admin/customers');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// 8. Deactivate Customer
export const deactivateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [profiles] = await db.query('SELECT user_id FROM customer_profiles WHERE id = ?', [id]);
    if (profiles.length > 0) {
      await db.query(`UPDATE users SET account_status = 'INACTIVE' WHERE id = ?`, [profiles[0].user_id]);
      await db.query(`UPDATE customer_profiles SET profile_status = 'INACTIVE' WHERE id = ?`, [id]);

      const adminId = (req?.user?.id) || (res?.locals?.user?.id) || null;
      await db.query(
        `INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, created_at)
         VALUES (?, 'CUSTOMERS', 'customer_profiles', ?, 'UPDATE', ?, NOW())`,
        [adminId, id, `Admin deactivated customer profile ID #${id}`]
      );
    }
    res.redirect(`/admin/customers/${id}`);
  } catch (err) {
    next(err);
  }
};

// 9. Reactivate Customer
export const reactivateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [profiles] = await db.query('SELECT user_id FROM customer_profiles WHERE id = ?', [id]);
    if (profiles.length > 0) {
      await db.query(`UPDATE users SET account_status = 'ACTIVE' WHERE id = ?`, [profiles[0].user_id]);
      await db.query(`UPDATE customer_profiles SET profile_status = 'ACTIVE' WHERE id = ?`, [id]);

      // Audit log: Customer reactivated
      const adminId = (req?.user?.id) || (res?.locals?.user?.id) || null;
      await db.query(
        `INSERT INTO audit_logs (user_id, module_name, entity_name, entity_id, action, description, created_at)
         VALUES (?, 'CUSTOMERS', 'customer_profiles', ?, 'UPDATE', ?, NOW())`,
        [adminId, id, `Admin reactivated customer profile ID #${id}`]
      );
    }
    res.redirect(`/admin/customers/${id}`);
  } catch (err) {
    next(err);
  }
};

export const showCreateApplicationForm = async (req, res, next) => {
  try {
    const { id } = req.params; // customer_profiles.id
    const [rows] = await db.query(`
      SELECT c.*, u.email 
      FROM customer_profiles c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).send('Customer not found');
    const customer = rows[0];

    // Block creation if customer already has an unresolved application
    const [existingApps] = await db.query(
      `SELECT id, application_number, application_status FROM loan_applications 
       WHERE customer_id = ? AND application_status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED') 
       AND NOT EXISTS (SELECT 1 FROM loans WHERE application_id = loan_applications.id)
       ORDER BY id DESC LIMIT 1`,
      [id]
    );
    if (existingApps.length > 0) {
      const existing = existingApps[0];
      return res.redirect(`/admin/customers?error=Customer+already+has+an+unresolved+application+(${existing.application_number}+%E2%80%94+${existing.application_status})`);
    }

    res.render('admin/applications/new', {
      title: 'Create Loan Application',
      customer,
      error: null
    });
  } catch (err) {
    next(err);
  }
};

// 10. Process Admin Created Application
export const createApplication = async (req, res, next) => {
  try {
    const customer_id = req.params.id;
    const adminId = res.locals.user.id;

    // Server-side validation
    const { requested_amount, loan_purpose } = req.body;
    if (!requested_amount || isNaN(requested_amount) || Number(requested_amount) <= 0) {
      const [rows] = await db.query(`SELECT c.*, u.email FROM customer_profiles c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [customer_id]);
      return res.render('admin/applications/new', { title: 'Create Loan Application', customer: rows[0] || {}, error: 'A valid requested amount is required.' });
    }

    // Block duplicate unresolved applications
    const [existingApps] = await db.query(
      "SELECT id, application_number FROM loan_applications WHERE customer_id = ? AND application_status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED') AND NOT EXISTS (SELECT 1 FROM loans WHERE application_id = loan_applications.id)",
      [customer_id]
    );
    if (existingApps.length > 0) {
      const [rows] = await db.query(`SELECT c.*, u.email FROM customer_profiles c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [customer_id]);
      return res.render('admin/applications/new', {
        title: 'Create Loan Application',
        customer: rows[0] || {},
        error: `Customer already has an unresolved application (${existingApps[0].application_number}). Resolve it before creating a new one.`
      });
    }

    // Generate a unique application number
    const appNumber = `APP${Date.now().toString().slice(-6)}`;

    let defaultLoanTypeId = req.body.loan_type_id || null;
    let defaultDuration = req.body.requested_duration_months || null;

    if (!defaultLoanTypeId) {
      const [types] = await db.query('SELECT id, minimum_duration_months FROM loan_types WHERE is_active = 1 ORDER BY display_order ASC LIMIT 1');
      if (types.length > 0) {
        defaultLoanTypeId = types[0].id;
        if (!defaultDuration) {
          defaultDuration = types[0].minimum_duration_months || 12;
        }
      }
    }

    const appData = {
      customer_id,
      application_number: appNumber,
      application_status: 'PENDING',
      loan_type_id: defaultLoanTypeId,
      requested_duration_months: defaultDuration,
      requested_amount: Number(requested_amount),
      purpose: (loan_purpose && loan_purpose.trim()) ? loan_purpose.trim() : null,
      monthly_income: req.body.monthly_income ? Number(req.body.monthly_income) : 0
    };

    await loanAppModel.createApplication(db, appData);
    res.redirect(`/admin/applications?success=Application+${appNumber}+created+and+pending+review`);
  } catch (error) {
    logger.error('ADMIN LOAN APPLICATION SUBMIT ERROR:', error);
    next(error);
  }
};
