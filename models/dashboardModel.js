// Dashboard Model
export const getDashboardStats = async (db) => {
  try {
    // TODO: Implement dashboard stats queries
    return {};
  } catch (error) {
    throw new Error(`Error fetching dashboard stats: ${error.message}`);
  }
};

export const getAdminKPIs = async (db) => {
  try {
    const [[{ total_customers }]] = await db.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'CUSTOMER'");
    const [[{ active_loans }]] = await db.query("SELECT COUNT(*) AS active_loans FROM loans WHERE loan_status = 'ACTIVE'");
    const [[{ total_money_lent }]] = await db.query("SELECT COALESCE(SUM(principal_amount), 0) AS total_money_lent FROM loans WHERE loan_status IN ('ACTIVE', 'COMPLETED', 'DEFAULTED')");
    const [[{ approved_loans }]] = await db.query("SELECT COUNT(*) AS approved_loans FROM loan_applications WHERE application_status = 'APPROVED'");
    const [[{ todays_collections }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS todays_collections FROM payments WHERE DATE(payment_date) = CURDATE() AND payment_status = 'SUCCESS'");
    const [[{ total_repayments_received }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS total_repayments_received FROM payments WHERE payment_status = 'SUCCESS'");
    const [[{ outstanding_balance }]] = await db.query("SELECT COALESCE(SUM(outstanding_balance), 0) AS outstanding_balance FROM loans WHERE loan_status = 'ACTIVE'");
    const [[{ overdue_amount }]] = await db.query("SELECT COALESCE(SUM(total_amount + penalty_amount - paid_amount), 0) AS overdue_amount FROM loan_installments WHERE installment_status = 'OVERDUE'");
    const [[{ closed_loans }]] = await db.query("SELECT COUNT(*) AS closed_loans FROM loans WHERE loan_status = 'COMPLETED'");

    return {
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
  } catch (error) {
    throw new Error(`Error fetching admin KPIs: ${error.message}`);
  }
};

export const getCustomerDashboardData = async (db, customerId) => {
  try {
    // TODO: Implement customer dashboard queries
    return {};
  } catch (error) {
    throw new Error(`Error fetching customer dashboard data: ${error.message}`);
  }
};
