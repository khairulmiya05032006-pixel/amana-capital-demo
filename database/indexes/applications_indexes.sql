CREATE INDEX idx_application_customer
ON loan_applications(customer_id);

CREATE INDEX idx_application_status
ON loan_applications(application_status);

CREATE INDEX idx_application_type
ON loan_applications(loan_type_id);

CREATE INDEX idx_application_date
ON loan_applications(applied_at);

CREATE INDEX idx_application_reviewed
ON loan_applications(reviewed_by);
