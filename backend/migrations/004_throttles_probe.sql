CREATE TABLE rate_limit_counters (
 bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 hits INT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 INDEX rate_expiry(expires_at)
) ENGINE=InnoDB;
CREATE TABLE release_probes (
 id VARCHAR(36) PRIMARY KEY,
 release_id VARCHAR(160) NOT NULL,
 marker_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 visitor_id VARCHAR(36) NULL,
 expires_at DATETIME(3) NOT NULL,
 INDEX probe_release(release_id),
 INDEX probe_expiry(expires_at),
 FOREIGN KEY(visitor_id) REFERENCES visitors(id)
) ENGINE=InnoDB;
