ALTER TABLE loan_applications MODIFY COLUMN loan_type_id BIGINT UNSIGNED NULL;
ALTER TABLE loan_applications MODIFY COLUMN requested_duration_months SMALLINT UNSIGNED NULL;

ALTER TABLE loans MODIFY COLUMN loan_type_id BIGINT UNSIGNED NULL;

ALTER TABLE penalty_settings ADD COLUMN version INT DEFAULT 1;
