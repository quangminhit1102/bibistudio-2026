CREATE TABLE refresh_token_sessions (
 id VARCHAR(36) PRIMARY KEY,
 user_id VARCHAR(36) NOT NULL,
 auth_version INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL,
 last_activity_at DATETIME(3) NOT NULL,
 idle_expires_at DATETIME(3) NOT NULL,
 absolute_expires_at DATETIME(3) NOT NULL,
 revoked_at DATETIME(3) NULL,
 revoke_reason VARCHAR(80) NULL,
 INDEX sessions_user(user_id,revoked_at),
 INDEX sessions_expiry(absolute_expires_at),
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE refresh_tokens (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 session_id VARCHAR(36) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 consumed_at DATETIME(3) NULL,
 INDEX tokens_session(session_id),
 FOREIGN KEY(session_id) REFERENCES refresh_token_sessions(id)
) ENGINE=InnoDB;
CREATE TABLE audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_id VARCHAR(36) NULL,
 action VARCHAR(100) NOT NULL,
 target_type VARCHAR(50) NULL,
 target_id VARCHAR(100) NULL,
 metadata JSON NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX audit_time(created_at,id),
 INDEX audit_actor(actor_id,created_at)
) ENGINE=InnoDB;
