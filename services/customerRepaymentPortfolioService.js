import db from '../config/db.js';

class CustomerRepaymentPortfolioService {
  /**
   * Retrieves customers along with their loan/frequency data for the Customer Management page.
   * If a customer has multiple loans, they will appear multiple times (one for each loan/frequency).
   * Customers without loans will appear with a 'NO ACTIVE LOAN' status unless filtered out by frequency.
   */
  static async getCustomerPortfolio(filters = {}) {
    const { frequency, q } = filters;
    
    let query = `
      SELECT 
        c.id AS customer_id,
        c.customer_code,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        u.email,
        l.id AS loan_id,
        l.loan_number,
        l.outstanding_balance,
        l.loan_status,
        lss.scheme_name,
        lss.repayment_frequency AS frequency,
        la.application_status,
        la.application_number,
        
        -- Get the next pending/partial/overdue installment
        (SELECT due_date 
         FROM loan_installments 
         WHERE loan_id = l.id 
           AND installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE') 
         ORDER BY due_date ASC 
         LIMIT 1) AS next_payment_date,
         
        (SELECT (total_amount - paid_amount)
         FROM loan_installments 
         WHERE loan_id = l.id 
           AND installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE') 
         ORDER BY due_date ASC 
         LIMIT 1) AS next_payment_amount,
         
        (SELECT installment_status
         FROM loan_installments 
         WHERE loan_id = l.id 
           AND installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE') 
         ORDER BY due_date ASC 
         LIMIT 1) AS next_payment_status,
         
        (SELECT COUNT(*) FROM loans WHERE application_id = la.id) AS application_has_loan

      FROM customer_profiles c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN loans l ON c.id = l.customer_id AND l.loan_status IN ('ACTIVE', 'OVERDUE')
      LEFT JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      LEFT JOIN (
          SELECT * FROM loan_applications
          WHERE id IN (
              SELECT MAX(id) FROM loan_applications GROUP BY customer_id
          )
      ) la ON c.id = la.customer_id
      WHERE u.role = 'CUSTOMER'
    `;

    const queryParams = [];

    if (frequency && frequency !== 'ALL') {
      // If frequency is specified, only show customers with an active loan of that frequency
      query += ` AND lss.repayment_frequency = ? AND l.loan_status IN ('ACTIVE', 'OVERDUE')`;
      queryParams.push(frequency);
    }

    if (q) {
      const searchParam = `%${q}%`;
      query += ` AND (
        c.full_name LIKE ? OR 
        u.email LIKE ? OR 
        c.phone LIKE ? OR 
        c.customer_code LIKE ? OR 
        l.loan_number LIKE ?
      )`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY c.created_at DESC, l.created_at DESC`;

    const [rows] = await db.query(query, queryParams);

    // Map rows to a cleaner format with derived status
    return rows.map(row => {
      let derivedLoanStatus = 'NO ACTIVE LOAN';
      
      if (row.loan_id) {
        if (row.loan_status === 'OVERDUE' || row.next_payment_status === 'OVERDUE') {
          derivedLoanStatus = 'OVERDUE';
        } else {
          derivedLoanStatus = 'ACTIVE';
        }
      } else if (row.application_status === 'APPROVED' && row.application_has_loan === 0) {
        derivedLoanStatus = 'AWAITING DISBURSEMENT';
      } else if (row.application_status === 'PENDING' || row.application_status === 'UNDER_REVIEW') {
        derivedLoanStatus = 'APPLICATION PENDING';
      } else if (row.application_status === 'REJECTED') {
        derivedLoanStatus = 'APPLICATION REJECTED';
      }

      return {
        ...row,
        derived_loan_status: derivedLoanStatus
      };
    });
  }

  /**
   * Retrieves the repayment portfolio for the Repayments page.
   * Focuses on the installments that are due.
   */
  static async getRepaymentPortfolio(filters = {}) {
    const { frequency, status, q } = filters;

    let query = `
      SELECT 
        c.id AS customer_id,
        c.customer_code,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        l.id AS loan_id,
        l.loan_number,
        l.outstanding_balance,
        l.loan_status,
        lss.scheme_name,
        lss.repayment_frequency AS frequency,
        li.id AS installment_id,
        li.installment_number,
        li.due_date AS next_payment_date,
        (li.total_amount - li.paid_amount) AS installment_amount,
        li.penalty_amount,
        (li.total_amount - li.paid_amount + li.penalty_amount) AS total_due,
        li.installment_status,
        DATEDIFF(CURRENT_DATE, li.due_date) AS days_overdue
      FROM loans l
      JOIN customer_profiles c ON l.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      -- Get only the FIRST unpaid installment for each loan
      JOIN (
        SELECT id, loan_id, installment_number, due_date, total_amount, paid_amount, penalty_amount, installment_status,
               ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY due_date ASC) as rn
        FROM loan_installments
        WHERE installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
      ) li ON l.id = li.loan_id AND li.rn = 1
      WHERE l.loan_status IN ('ACTIVE', 'OVERDUE')
    `;

    const queryParams = [];

    if (frequency && frequency !== 'ALL') {
      query += ` AND lss.repayment_frequency = ?`;
      queryParams.push(frequency);
    }

    if (status && status !== 'ALL') {
      if (status === 'OVERDUE') {
        query += ` AND (l.loan_status = 'OVERDUE' OR li.installment_status = 'OVERDUE' OR li.due_date < CURRENT_DATE)`;
      } else if (status === 'ACTIVE') {
        query += ` AND l.loan_status = 'ACTIVE' AND li.installment_status != 'OVERDUE' AND li.due_date >= CURRENT_DATE`;
      }
    }

    if (q) {
      const searchParam = `%${q}%`;
      query += ` AND (
        c.full_name LIKE ? OR 
        u.email LIKE ? OR 
        c.phone LIKE ? OR 
        c.customer_code LIKE ? OR 
        l.loan_number LIKE ?
      )`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY li.due_date ASC`;

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  /**
   * Retrieves summary statistics for the Customer Management and Repayment pages.
   */
  static async getPortfolioSummary() {
    const [counts] = await db.query(`
      SELECT 
        SUM(CASE WHEN lss.repayment_frequency = 'DAILY' THEN 1 ELSE 0 END) AS daily_loans_count,
        SUM(CASE WHEN lss.repayment_frequency = 'WEEKLY' THEN 1 ELSE 0 END) AS weekly_loans_count,
        SUM(CASE WHEN lss.repayment_frequency = 'MONTHLY' THEN 1 ELSE 0 END) AS monthly_loans_count,
        COUNT(*) AS total_active_loans,
        SUM(l.outstanding_balance) AS total_outstanding
      FROM loans l
      JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      WHERE l.loan_status IN ('ACTIVE', 'OVERDUE')
    `);

    const [dues] = await db.query(`
      SELECT 
        lss.repayment_frequency,
        SUM(li.total_amount - li.paid_amount + li.penalty_amount) AS total_due
      FROM loans l
      JOIN loan_scheme_snapshots lss ON l.id = lss.loan_id
      JOIN (
        SELECT loan_id, total_amount, paid_amount, penalty_amount,
               ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY due_date ASC) as rn
        FROM loan_installments
        WHERE installment_status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
      ) li ON l.id = li.loan_id AND li.rn = 1
      WHERE l.loan_status IN ('ACTIVE', 'OVERDUE')
      GROUP BY lss.repayment_frequency
    `);

    // Today's Collection
    const [collections] = await db.query(`
      SELECT SUM(payment_amount) AS today_collection
      FROM payments
      WHERE DATE(payment_date) = CURRENT_DATE AND payment_status = 'SUCCESS'
    `);

    const duesMap = {
      DAILY: 0,
      WEEKLY: 0,
      MONTHLY: 0
    };
    
    dues.forEach(d => {
      duesMap[d.repayment_frequency] = parseFloat(d.total_due) || 0;
    });

    return {
      daily_loans_count: parseInt(counts[0].daily_loans_count) || 0,
      weekly_loans_count: parseInt(counts[0].weekly_loans_count) || 0,
      monthly_loans_count: parseInt(counts[0].monthly_loans_count) || 0,
      total_active_loans: parseInt(counts[0].total_active_loans) || 0,
      total_outstanding: parseFloat(counts[0].total_outstanding) || 0,
      
      daily_due_amount: duesMap.DAILY,
      weekly_due_amount: duesMap.WEEKLY,
      monthly_due_amount: duesMap.MONTHLY,
      
      today_collection: parseFloat(collections[0].today_collection) || 0
    };
  }
}

export default CustomerRepaymentPortfolioService;
