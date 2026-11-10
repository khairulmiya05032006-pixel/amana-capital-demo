CREATE INDEX idx_audit_user
ON audit_logs(user_id);

CREATE INDEX idx_audit_module
ON audit_logs(module_name);

CREATE INDEX idx_audit_entity
ON audit_logs(entity_name, entity_id);

CREATE INDEX idx_audit_action
ON audit_logs(action);

CREATE INDEX idx_audit_created_at
ON audit_logs(created_at);

CREATE INDEX idx_audit_ip
ON audit_logs(ip_address);
