CREATE INDEX idx_installment_loan
ON loan_installments(loan_id);

CREATE INDEX idx_installment_due_date
ON loan_installments(due_date);

CREATE INDEX idx_installment_status
ON loan_installments(installment_status);

CREATE INDEX idx_installment_paid_date
ON loan_installments(paid_date);
