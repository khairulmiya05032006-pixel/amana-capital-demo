ALTER TABLE loan_applications ADD COLUMN loan_scheme_id BIGINT UNSIGNED NULL AFTER loan_type_id;
ALTER TABLE loan_applications ADD CONSTRAINT fk_app_scheme FOREIGN KEY (loan_scheme_id) REFERENCES loan_schemes(id) ON DELETE RESTRICT;
