CREATE INDEX idx_loans_customer
ON loans(customer_id);

CREATE INDEX idx_loans_status
ON loans(loan_status);

CREATE INDEX idx_loans_application
ON loans(application_id);

CREATE INDEX idx_loans_disbursement
ON loans(disbursement_date);

CREATE INDEX idx_loans_maturity
ON loans(maturity_date);
