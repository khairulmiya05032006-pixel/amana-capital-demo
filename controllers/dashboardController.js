import logger from '../utils/logger.js';
// Dashboard Controller
import db from '../config/db.js';
import { getAccountSummary, getRecentLoansByCustomer, getUpcomingPayments as getUpcomingPaymentsHelper } from '../models/dashboardHelper.js';

// Dashboard Summary API
export const getDashboardSummary = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const summary = await getAccountSummary(db, customerId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAdminDashboard = async (req, res) => {
  try {
    // TODO: Implement admin dashboard logic
    res.status(501).json({ message: 'Admin dashboard not implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCustomerDashboard = async (req, res) => {
  try {
    if (!res.locals.user) return res.redirect('/auth/login');
    const userId = res.locals.user.id;
    
    // Fetch customer profile
    const [profiles] = await db.query('SELECT * FROM customer_profiles WHERE user_id = ?', [userId]);
    const userProfile = profiles.length > 0 ? profiles[0] : { full_name: 'Customer' };
    
    const user = { ...res.locals.user, first_name: userProfile.full_name };

    // Fetch dashboard summary by bypassing vw_customer_summary
    const [[{ total_outstanding_balance }]] = await db.query('SELECT COALESCE(SUM(outstanding_balance), 0) as total_outstanding_balance FROM loans WHERE customer_id = ? AND loan_status = "ACTIVE"', [userProfile.id]);
    const [[{ total_loans }]] = await db.query('SELECT COUNT(*) as total_loans FROM loans WHERE customer_id = ?', [userProfile.id]);
    const [[{ active_loans }]] = await db.query('SELECT COUNT(*) as active_loans FROM loans WHERE customer_id = ? AND loan_status = "ACTIVE"', [userProfile.id]);
    
    const summary = { total_outstanding_balance, total_loans, active_loans };
    
    // Find upcoming payments for ALL active loans
    const [activeLoans] = await db.query(`
      SELECT l.id, l.loan_number, l.repayment_frequency, 
             COALESCE(s.scheme_name, CONCAT(UPPER(SUBSTRING(l.repayment_frequency, 1, 1)), LOWER(SUBSTRING(l.repayment_frequency, 2)), ' Business Loan')) as scheme_name,
             (SELECT total_amount FROM loan_installments i WHERE i.loan_id = l.id AND i.installment_status = 'PENDING' ORDER BY due_date ASC LIMIT 1) as next_amount,
             (SELECT due_date FROM loan_installments i WHERE i.loan_id = l.id AND i.installment_status = 'PENDING' ORDER BY due_date ASC LIMIT 1) as next_due_date
      FROM loans l
      LEFT JOIN loan_scheme_snapshots s ON l.id = s.loan_id
      WHERE l.customer_id = ? AND l.loan_status = 'ACTIVE'
    `, [userProfile.id]);

    const upcomingPayments = activeLoans.filter(l => l.next_amount !== null).map(l => {
      // Determine relative date logic for display
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(l.next_due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let dateString = '';
      let status = 'DUE';
      if (diffDays < 0) {
        dateString = 'Overdue';
        status = 'OVERDUE';
      } else if (diffDays === 0) {
        dateString = 'Today';
      } else if (diffDays === 1) {
        dateString = 'Tomorrow';
      } else {
        dateString = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      return {
        loan_id: l.id,
        frequency: l.repayment_frequency,
        scheme_name: l.scheme_name,
        amount: l.next_amount,
        dueDateRaw: l.next_due_date,
        dueDateString: dateString,
        status: status
      };
    }).sort((a, b) => new Date(a.dueDateRaw) - new Date(b.dueDateRaw));

    const dashboardData = {
      totalBalance: summary.total_outstanding_balance,
      totalLoans: summary.total_loans,
      activeLoans: summary.active_loans || 0,
      overallOutstanding: summary.total_outstanding_balance,
      upcomingPayments: upcomingPayments
    };

    // Fetch active loans full object for backward compatibility
    const loans = activeLoans;

    // Fetch loan applications (Request status)
    const [applications] = await db.query("SELECT * FROM loan_applications WHERE customer_id = ? ORDER BY created_at DESC", [userProfile.id]);

    const notifications = upcomingPayments.map(p => ({
      text: `Payment of ₹${Number(p.amount).toLocaleString('en-IN')} due ${p.dueDateString.toLowerCase()} for ${p.scheme_name}`,
      status: p.status
    }));

    // Keep emiSchedule defined as empty to avoid template errors if legacy code remains
    const emiSchedule = [];

    res.render('customer/dashboard', {
      user,
      dashboardData,
      loans,
      applications,
      notifications,
      emiSchedule,
      title: 'Dashboard'
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).render('errors/500', { 
      error: error.message,
      title: 'Error' 
    });
  }
};
export const getRecentLoans = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const { loans, total } = await getRecentLoansByCustomer(db, customerId, page, limit);
    res.json({ success: true, data: { loans, total, page, limit } });
  } catch (error) {
    logger.error('Recent loans error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getUpcomingPayments = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const { payments, total } = await getUpcomingPaymentsHelper(db, customerId, page, limit);
    res.json({ success: true, data: { payments, total, page, limit } });
  } catch (error) {
    logger.error('Upcoming payments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
