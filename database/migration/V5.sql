-- 1. Create definitive penalties table tracking loan_installments (MariaDB 10.11+)
CREATE TABLE IF NOT EXISTS penalties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id BIGINT UNSIGNED NOT NULL,
    installment_id BIGINT UNSIGNED NOT NULL,
    penalty_amount DECIMAL(15,2) NOT NULL,
    penalty_type VARCHAR(50) NOT NULL,
    policy_version INT NOT NULL DEFAULT 1,
    status ENUM('APPLIED', 'WAIVED', 'UNPAID', 'PARTIALLY_PAID', 'PAID') NOT NULL DEFAULT 'APPLIED',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    CONSTRAINT fk_penalties_loan FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_penalties_installment FOREIGN KEY(installment_id) REFERENCES loan_installments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uk_installment_penalty_type (installment_id, penalty_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Terminate legacy MySQL Events (Node runner takes authoritative control)
DROP EVENT IF EXISTS evt_mark_overdue_installments;
DROP EVENT IF EXISTS ev_mark_overdue;
DROP EVENT IF EXISTS ev_mark_overdue_v2;