ALTER TABLE visitor_sessions ADD COLUMN client_ip VARCHAR(45) NULL;
ALTER TABLE visitor_sessions ADD COLUMN ip_status VARCHAR(20) NOT NULL DEFAULT 'legacy';
ALTER TABLE visitor_sessions ADD COLUMN device_type VARCHAR(30) NULL;
ALTER TABLE visitor_sessions ADD COLUMN operating_system VARCHAR(50) NULL;
ALTER TABLE visitor_sessions ADD COLUMN browser VARCHAR(50) NULL;
ALTER TABLE visitor_sessions ADD INDEX visitor_history_window(started_at,visitor_id,id);
ALTER TABLE visitor_sessions ADD INDEX visitor_history_identity(visitor_id,started_at,id);
