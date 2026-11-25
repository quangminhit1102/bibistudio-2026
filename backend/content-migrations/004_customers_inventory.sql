ALTER TABLE customers
  ADD COLUMN representative VARCHAR(255) NULL,
  ADD COLUMN extra JSON NULL;

CREATE TABLE stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  delta INT NOT NULL,
  stock_before INT NOT NULL,
  stock_after INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  source VARCHAR(32) NOT NULL,
  actor_id VARCHAR(36) NULL,
  actor_name VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_stock_movements_product_created (product_id, created_at),
  KEY idx_stock_movements_created (created_at)
) ENGINE=InnoDB;
