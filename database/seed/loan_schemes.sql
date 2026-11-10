INSERT INTO loan_schemes (scheme_code, scheme_name, description, status, interest_type, base_interest_rate, repayment_frequency, duration_value, duration_unit, grace_period_days, penalty_type, penalty_value, processing_fee_type, processing_fee_value) VALUES 
('STD_MONTHLY', 'Standard Monthly Personal Loan', 'A standard monthly personal loan scheme.', 'ACTIVE', 'REDUCING_BALANCE', 12.50, 'MONTHLY', 12, 'MONTHS', 0, 'PERCENTAGE', 2.00, 'PERCENTAGE', 1.50), 
('STD_WEEKLY', 'Standard Weekly Microloan', 'A standard weekly microloan.', 'ACTIVE', 'FLAT', 10.00, 'WEEKLY', 24, 'WEEKS', 0, 'FIXED', 50.00, 'FIXED', 500.00),
('STD_DAILY', 'Standard Daily Loan', 'A standard daily collection loan scheme.', 'ACTIVE', 'FLAT', 5.00, 'DAILY', 30, 'DAYS', 0, 'FIXED', 10.00, 'PERCENTAGE', 1.00)
ON DUPLICATE KEY UPDATE status=VALUES(status);
