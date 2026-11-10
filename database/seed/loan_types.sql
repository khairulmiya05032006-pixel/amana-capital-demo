

INSERT INTO loan_types 
(loan_type_code, loan_name, description, minimum_amount, maximum_amount, minimum_interest_rate, maximum_interest_rate, minimum_duration_months, maximum_duration_months, processing_fee_percentage, late_fee_percentage, penalty_interest_percentage, is_active, display_order)
VALUES 
('PL01', 'Personal Loan', 'Unsecured loan for personal use.', 10000.00, 500000.00, 10.00, 15.00, 6, 60, 2.00, 5.00, 2.00, TRUE, 1),
('BL01', 'Business Loan', 'Loan for business expansion.', 50000.00, 2000000.00, 12.00, 18.00, 12, 120, 1.50, 5.00, 2.00, TRUE, 2)
ON DUPLICATE KEY UPDATE is_active = TRUE;
