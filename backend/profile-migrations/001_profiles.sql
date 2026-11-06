ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL;
ALTER TABLE users ADD COLUMN avatar_id CHAR(36) NULL;
CREATE TABLE profile_avatar_assets (
 id CHAR(36) PRIMARY KEY,
 user_id VARCHAR(36) NOT NULL,
 format VARCHAR(4) NOT NULL,
 width INT UNSIGNED NOT NULL,
 height INT UNSIGNED NOT NULL,
 bytes INT UNSIGNED NOT NULL,
 sha256 CHAR(64) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 retired_at DATETIME(3) NULL,
 INDEX profile_avatar_owner (user_id),
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
