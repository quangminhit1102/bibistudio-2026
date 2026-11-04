CREATE TABLE visitors (
 id VARCHAR(36) PRIMARY KEY,
 identity_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 ip_prefix VARCHAR(64) NOT NULL,
 country VARCHAR(100) NULL,
 city VARCHAR(100) NULL,
 device_type VARCHAR(30) NOT NULL,
 operating_system VARCHAR(50) NOT NULL,
 browser VARCHAR(50) NOT NULL,
 first_seen_at DATETIME(3) NOT NULL,
 last_seen_at DATETIME(3) NOT NULL,
 session_count INT UNSIGNED NOT NULL DEFAULT 0,
 is_probe BOOLEAN NOT NULL DEFAULT FALSE,
 INDEX visitors_seen(last_seen_at,id)
) ENGINE=InnoDB;
CREATE TABLE visitor_sessions (
 id VARCHAR(36) PRIMARY KEY,
 visitor_id VARCHAR(36) NOT NULL,
 started_at DATETIME(3) NOT NULL,
 last_received_at DATETIME(3) NOT NULL,
 landing_path VARCHAR(512) NOT NULL,
 last_received_path VARCHAR(512) NOT NULL,
 page_count INT UNSIGNED NOT NULL DEFAULT 0,
 product_count INT UNSIGNED NOT NULL DEFAULT 0,
 truncated BOOLEAN NOT NULL DEFAULT FALSE,
 INDEX visitor_session_activity(visitor_id,last_received_at),
 INDEX visitor_session_retention(last_received_at,id),
 FOREIGN KEY(visitor_id) REFERENCES visitors(id)
) ENGINE=InnoDB;
CREATE TABLE visitor_session_pages (
 session_id VARCHAR(36) NOT NULL,
 path VARCHAR(512) NOT NULL,
 first_received_at DATETIME(3) NOT NULL,
 last_received_at DATETIME(3) NOT NULL,
 PRIMARY KEY(session_id,path),
 FOREIGN KEY(session_id) REFERENCES visitor_sessions(id)
) ENGINE=InnoDB;
CREATE TABLE visitor_viewed_products (
 session_id VARCHAR(36) NOT NULL,
 product_slug VARCHAR(160) NOT NULL,
 first_received_at DATETIME(3) NOT NULL,
 last_received_at DATETIME(3) NOT NULL,
 PRIMARY KEY(session_id,product_slug),
 INDEX product_interest(product_slug,last_received_at),
 FOREIGN KEY(session_id) REFERENCES visitor_sessions(id)
) ENGINE=InnoDB;
