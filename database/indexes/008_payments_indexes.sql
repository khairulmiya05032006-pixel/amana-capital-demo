CREATE INDEX idx_payment_customer
ON payments(customer_id);

CREATE INDEX idx_payment_loan
ON payments(loan_id);

CREATE INDEX idx_payment_installment
ON payments(installment_id);

CREATE INDEX idx_payment_date
ON payments(payment_date);

CREATE INDEX idx_payment_method
ON payments(payment_method);

CREATE INDEX idx_payment_status
ON payments(payment_status);

CREATE INDEX idx_payment_collector
ON payments(collected_by);
