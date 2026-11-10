import db from '../config/db.js';

export const checkDeletionEligibility = async (customerId, connection = db) => {
  const result = {
    canDelete: true,
    reason: null,
    customerState: {
      activeLoans: 0,
      outstandingBalance: 0,
      pendingInstallments: 0,
      overdueInstallments: 0,
      unpaidPenalties: 0,
      pendingApplications: 0,
      approvedUndisbursedApplications: 0,
      closedLoans: 0
    }
  };

  // 1. Loans
  const [loans] = await connection.query('SELECT id, application_id, loan_status, outstanding_balance FROM loans WHERE customer_id = ?', [customerId]);
  const loanIds = loans.map(l => l.id);
  const disbursedAppIds = loans.filter(l => l.application_id).map(l => l.application_id);

  loans.forEach(loan => {
    if (loan.loan_status === 'ACTIVE') result.customerState.activeLoans++;
    if (loan.loan_status === 'CLOSED') result.customerState.closedLoans++;
    result.customerState.outstandingBalance += parseFloat(loan.outstanding_balance || 0);
  });

  // 2. Applications
  const [apps] = await connection.query('SELECT id, application_status FROM loan_applications WHERE customer_id = ?', [customerId]);
  apps.forEach(app => {
    if (app.application_status === 'PENDING' || app.application_status === 'UNDER_REVIEW') {
      result.customerState.pendingApplications++;
    } else if (app.application_status === 'APPROVED') {
      if (!disbursedAppIds.includes(app.id)) {
        result.customerState.approvedUndisbursedApplications++;
      }
    }
  });

  // 3. Installments
  if (loanIds.length > 0) {
    const [installments] = await connection.query('SELECT id, installment_status, due_date FROM loan_installments WHERE loan_id IN (?)', [loanIds]);
    const now = new Date();
    installments.forEach(inst => {
      if (inst.installment_status !== 'PAID') {
        result.customerState.pendingInstallments++;
        if (new Date(inst.due_date) < now) {
          result.customerState.overdueInstallments++;
        }
      }
    });

    // 4. Penalties
    const [penalties] = await connection.query('SELECT id FROM penalties WHERE loan_id IN (?) AND status NOT IN ("PAID", "WAIVED")', [loanIds]);
    result.customerState.unpaidPenalties = penalties.length;
  }

  // 5. Evaluate Eligibility
  if (result.customerState.pendingApplications > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted with pending applications.";
  } else if (result.customerState.approvedUndisbursedApplications > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted because an approved loan application has not been disbursed.";
  } else if (result.customerState.activeLoans > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted while an active loan exists.";
  } else if (result.customerState.outstandingBalance > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted while an outstanding balance exists.";
  } else if (result.customerState.pendingInstallments > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted while pending or overdue installments exist.";
  } else if (result.customerState.unpaidPenalties > 0) {
    result.canDelete = false;
    result.reason = "Customer cannot be deleted while unpaid penalties exist.";
  }

  return result;
};
