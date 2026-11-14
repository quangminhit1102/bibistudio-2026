CREATE TABLE content_categories (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 parent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 normalized_slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 position INT UNSIGNED NOT NULL DEFAULT 0,
 active BOOLEAN NOT NULL DEFAULT 1,
 draft_json JSON NOT NULL,
 public_revision INT UNSIGNED NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 CONSTRAINT content_category_parent FOREIGN KEY(parent_id) REFERENCES content_categories(id)
) ENGINE=InnoDB;

CREATE TABLE content_category_revisions (
 category_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 data_json JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(category_id,revision),
 CONSTRAINT content_category_revision_owner FOREIGN KEY(category_id) REFERENCES content_categories(id)
) ENGINE=InnoDB;

CREATE TABLE content_posts (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 normalized_slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 category_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 draft_json JSON NOT NULL,
 trashed_at DATETIME(3) NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 INDEX content_posts_updated(updated_at,id),
 CONSTRAINT content_post_category FOREIGN KEY(category_id) REFERENCES content_categories(id)
) ENGINE=InnoDB;

CREATE TABLE content_post_revisions (
 post_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 data_json JSON NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(post_id,revision),
 CONSTRAINT content_post_revision_owner FOREIGN KEY(post_id) REFERENCES content_posts(id)
) ENGINE=InnoDB;

CREATE TABLE content_tags (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 normalized_name VARCHAR(100) COLLATE utf8mb4_bin NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE content_post_tags (
 post_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 tag_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(post_id,tag_id),
 CONSTRAINT content_tag_post FOREIGN KEY(post_id) REFERENCES content_posts(id),
 CONSTRAINT content_tag_label FOREIGN KEY(tag_id) REFERENCES content_tags(id)
) ENGINE=InnoDB;

CREATE TABLE content_slug_reservations (
 kind ENUM('post','category') NOT NULL,
 slug VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 target_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 is_canonical BOOLEAN NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(kind,slug),
 INDEX content_slug_target(kind,target_id)
) ENGINE=InnoDB;

CREATE TABLE content_media (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 original_name VARCHAR(255) NOT NULL,
 mime VARCHAR(32) CHARACTER SET ascii NOT NULL,
 width INT UNSIGNED NOT NULL,
 height INT UNSIGNED NOT NULL,
 original_bytes BIGINT UNSIGNED NOT NULL,
 state ENUM('staged','complete') NOT NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 INDEX content_media_created(created_at,id)
) ENGINE=InnoDB;

CREATE TABLE content_media_variants (
 media_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 file VARCHAR(240) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 mime VARCHAR(32) CHARACTER SET ascii NOT NULL,
 width INT UNSIGNED NOT NULL,
 height INT UNSIGNED NOT NULL,
 bytes BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(media_id,name),
 INDEX content_media_hash(hash),
 CONSTRAINT content_variant_media FOREIGN KEY(media_id) REFERENCES content_media(id)
) ENGINE=InnoDB;

CREATE TABLE content_media_references (
 owner_type ENUM('post','snapshot','job','generation') NOT NULL,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 media_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(owner_type,owner_id,media_id),
 CONSTRAINT content_reference_media FOREIGN KEY(media_id) REFERENCES content_media(id)
) ENGINE=InnoDB;

CREATE TABLE content_published_snapshots (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 post_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 draft_revision INT UNSIGNED NOT NULL,
 snapshot_json JSON NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY content_snapshot_revision(post_id,draft_revision),
 CONSTRAINT content_snapshot_post FOREIGN KEY(post_id) REFERENCES content_posts(id)
) ENGINE=InnoDB;

CREATE TABLE content_publication_jobs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 auth_version INT UNSIGNED NOT NULL,
 action VARCHAR(32) CHARACTER SET ascii NOT NULL,
 target_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expected_revision INT UNSIGNED NOT NULL,
 idempotency_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_json JSON NOT NULL,
 generation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 previous_generation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 status ENUM('queued','building','prepared','verifying','succeeded','failed') NOT NULL,
 error_json JSON NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 completed_at DATETIME(3) NULL,
 UNIQUE KEY content_job_idempotency(actor_id,idempotency_key),
 INDEX content_job_status(status,created_at,id)
) ENGINE=InnoDB;

CREATE TABLE content_generations (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 previous_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
 state ENUM('prepared','verifying','committed','failed','retired') NOT NULL,
 manifest_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL,
 committed_at DATETIME(3) NULL,
 CONSTRAINT content_generation_job FOREIGN KEY(job_id) REFERENCES content_publication_jobs(id)
) ENGINE=InnoDB;

CREATE TABLE content_generation_posts (
 generation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 snapshot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(generation_id,snapshot_id),
 CONSTRAINT content_generation_owner FOREIGN KEY(generation_id) REFERENCES content_generations(id),
 CONSTRAINT content_generation_snapshot FOREIGN KEY(snapshot_id) REFERENCES content_published_snapshots(id)
) ENGINE=InnoDB;

CREATE TABLE content_seed_imports (
 id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state ENUM('in_progress','complete') NOT NULL,
 imported_count INT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL,
 completed_at DATETIME(3) NULL
) ENGINE=InnoDB;
