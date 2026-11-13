ALTER TABLE visitor_sessions ADD COLUMN ip_source VARCHAR(30) NULL;
ALTER TABLE visitor_sessions ADD COLUMN ip_observed_at DATETIME(3) NULL;
ALTER TABLE visitor_sessions ADD COLUMN country_code CHAR(2) NULL;
ALTER TABLE visitor_sessions ADD COLUMN country_name VARCHAR(128) NULL;
ALTER TABLE visitor_sessions ADD COLUMN country_dataset VARCHAR(80) NULL;
ALTER TABLE visitor_sessions ADD COLUMN country_resolved_at DATETIME(3) NULL;
CREATE TABLE analytics_relay_receipts (request_id BINARY(16) PRIMARY KEY,expires_at DATETIME(3) NOT NULL,INDEX expires_at(expires_at)) ENGINE=InnoDB;
