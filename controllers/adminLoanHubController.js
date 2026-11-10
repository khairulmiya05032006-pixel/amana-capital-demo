import db from '../config/db.js';

export const getLoanHub = async (req, res, next) => {
  try {
    const search = req.query.q || '';
    let applications = [];
    let activeLoans = [];
    let closedLoans = [];

    const searchParam = search ? `%${search}%` : null;

    // Base Application Query
    let appQuery = `
      SELECT a.id as application_id, a.application_number, 
             COALESCE(a.approved_principal, a.requested_amount) as approved_amount,
             a.approved_interest_amount,
             a.approved_total_payable,
             a.interest_calculation_method,
             'Web' as application_source, a.reviewed_at as approved_at,
             c.id as customer_id, c.customer_code, c.full_name as customer_name, c.phone as customer_phone,
             COALESCE(ls.scheme_name, lt.loan_name) as scheme_name, 
             a.requested_duration_months as approved_duration, 
             COALESCE(ls.duration_unit, 'months') as approved_duration_unit,
             a.requested_interest_rate as approved_interest_rate
      FROM loan_applications a
      JOIN customer_profiles c ON a.customer_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN loan_schemes ls ON a.loan_scheme_id = ls.id
      LEFT JOIN loan_types lt ON a.loan_type_id = lt.id
      LEFT JOIN loans l ON a.id = l.application_id
      WHERE a.application_status = 'APPROVED' AND l.id IS NULL
    `;

    // Base Loan Query
    let loanQuery = `
      SELECT l.id as loan_id, l.loan_number, l.principal_amount, l.flat_interest_amount, l.total_interest, l.total_payable, l.outstanding_balance,
             l.first_installment_date, l.loan_status, l.repayment_frequency, l.maturity_date, l.interest_calculation_method,
             c.id as customer_id, c.customer_code, c.full_name as customer_name
      FROM loans l
      JOIN customer_profiles c ON l.customer_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN loan_applications a ON l.application_id = a.id
    `;

    if (search) {
      let appWhereClause = ` AND (c.customer_code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR u.email LIKE ? OR a.application_number LIKE ?`;
      let appParams = [searchParam, searchParam, searchParam, searchParam, searchParam];
      
      let loanWhereClause = ` WHERE (c.customer_code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR u.email LIKE ? OR l.loan_number LIKE ? OR a.application_number LIKE ?`;
      let loanParams = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam];

      if (!isNaN(search) && search.trim() !== '') {
        const numericSearch = Number(search);
        appWhereClause += ` OR c.id = ? OR a.id = ?`;
        appParams.push(numericSearch, numericSearch);
        
        loanWhereClause += ` OR c.id = ? OR a.id = ? OR l.id = ?`;
        loanParams.push(numericSearch, numericSearch, numericSearch);
      }
      
      appWhereClause += `)`;
      loanWhereClause += `)`;

      const [appRows] = await db.query(appQuery + appWhereClause + ' ORDER BY a.reviewed_at ASC', appParams);
      applications = appRows;

      const [activeRows] = await db.query(loanQuery + loanWhereClause + " AND l.loan_status = 'ACTIVE' ORDER BY l.created_at DESC", loanParams);
      activeLoans = activeRows;

      const [closedRows] = await db.query(loanQuery + loanWhereClause + " AND l.loan_status = 'CLOSED' ORDER BY l.created_at DESC", loanParams);
      closedLoans = closedRows;
    } else {
      const [appRows] = await db.query(appQuery + ' ORDER BY a.reviewed_at ASC');
      applications = appRows;

      const [activeRows] = await db.query(loanQuery + " WHERE l.loan_status = 'ACTIVE' ORDER BY l.created_at DESC");
      activeLoans = activeRows;

      const [closedRows] = await db.query(loanQuery + " WHERE l.loan_status = 'CLOSED' ORDER BY l.created_at DESC");
      closedLoans = closedRows;
    }

    const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

    res.render('admin/loans', {
      title: 'Loans & Disbursement',
      applications,
      activeLoans,
      closedLoans,
      searchQuery: search,
      formatINR,
      formatDate,
      user: res.locals.user,
      success: req.query.success,
      error: req.query.error
    });
  } catch (err) {
    next(err);
  }
};
