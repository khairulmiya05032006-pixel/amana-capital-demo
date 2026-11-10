CREATE INDEX idx_transaction_loan
ON loan_transactions(loan_id);

CREATE INDEX idx_transaction_customer
ON loan_transactions(customer_id);

CREATE INDEX idx_transaction_payment
ON loan_transactions(payment_id);

CREATE INDEX idx_transaction_date
ON loan_transactions(transaction_date);

CREATE INDEX idx_transaction_type
ON loan_transactions(transaction_type);

CREATE INDEX idx_transaction_created_by
ON loan_transactions(created_by);
