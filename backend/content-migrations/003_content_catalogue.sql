CREATE TABLE product_types (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  translations JSON NULL,
  image VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_product_types_code (code),
  UNIQUE KEY uq_product_types_slug (slug),
  KEY idx_product_types_active (active)
) ENGINE=InnoDB;

ALTER TABLE product_categories
  ADD COLUMN translations JSON NULL,
  ADD COLUMN image VARCHAR(500) NULL;

ALTER TABLE products
  ADD COLUMN attributes JSON NULL;
