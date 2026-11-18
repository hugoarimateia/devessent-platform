-- ==============================================================================
-- DEVESSENT PLATFORM — MIGRATION XAMPP / MARIADB 002
-- FASE 6C: Carrinho persistente, solicitações de pedido e histórico de status
-- ==============================================================================

USE `devessent_test`;

-- 14. Retail — Carrinhos Persistentes por Loja
CREATE TABLE IF NOT EXISTS `retail_carts` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `cart_token_hash` VARCHAR(128) NOT NULL,
  `status` ENUM('active', 'converted', 'expired', 'abandoned') NOT NULL DEFAULT 'active',
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_carts_tenant_token` (`tenant_id`, `cart_token_hash`),
  KEY `idx_retail_carts_lookup` (`store_id`, `cart_token_hash`, `status`),
  CONSTRAINT `fk_retail_carts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_retail_carts_store` FOREIGN KEY (`store_id`) REFERENCES `retail_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Retail — Itens do Carrinho
CREATE TABLE IF NOT EXISTS `retail_cart_items` (
  `id` CHAR(36) NOT NULL,
  `cart_id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `variant_id` CHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_cart_items_variant` (`cart_id`, `variant_id`),
  KEY `idx_retail_cart_items_cart` (`cart_id`),
  CONSTRAINT `fk_rci_cart` FOREIGN KEY (`cart_id`) REFERENCES `retail_carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rci_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rci_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rci_variant` FOREIGN KEY (`variant_id`) REFERENCES `retail_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Retail — Solicitações de Pedido / Pedidos
CREATE TABLE IF NOT EXISTS `retail_orders` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `cart_id` CHAR(36) NULL,
  `order_number` VARCHAR(32) NOT NULL,
  `public_token_hash` VARCHAR(128) NOT NULL,
  `status` ENUM('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'requested',
  `stock_deducted` TINYINT(1) NOT NULL DEFAULT 0,
  `channel` ENUM('storefront', 'manual') NOT NULL DEFAULT 'storefront',
  `currency` VARCHAR(5) NOT NULL DEFAULT 'BRL',
  `subtotal_cents` INT NOT NULL DEFAULT 0,
  `total_cents` INT NOT NULL DEFAULT 0,
  `customer_name` VARCHAR(160) NOT NULL,
  `customer_phone` VARCHAR(40) NOT NULL,
  `customer_email` VARCHAR(255) NULL,
  `delivery_mode` ENUM('pickup', 'delivery') NOT NULL DEFAULT 'pickup',
  `delivery_address` TEXT NULL,
  `notes` TEXT NULL,
  `cancellation_reason` TEXT NULL,
  `idempotency_key` VARCHAR(128) NULL,
  `confirmed_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_orders_tenant_number` (`tenant_id`, `order_number`),
  UNIQUE KEY `uq_retail_orders_tenant_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_retail_orders_tenant_status_created` (`tenant_id`, `status`, `created_at`),
  KEY `idx_retail_orders_tenant_created` (`tenant_id`, `created_at`),
  CONSTRAINT `fk_ro_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ro_store` FOREIGN KEY (`store_id`) REFERENCES `retail_stores` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ro_cart` FOREIGN KEY (`cart_id`) REFERENCES `retail_carts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Retail — Itens do Pedido (Snapshot Histórico Imutável)
CREATE TABLE IF NOT EXISTS `retail_order_items` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NULL,
  `variant_id` CHAR(36) NULL,
  `product_name_snapshot` VARCHAR(180) NOT NULL,
  `variant_name_snapshot` VARCHAR(180) NOT NULL,
  `sku_snapshot` VARCHAR(80) NOT NULL,
  `unit_price_cents` INT NOT NULL DEFAULT 0,
  `quantity` INT NOT NULL,
  `line_total_cents` INT NOT NULL DEFAULT 0,
  `image_url_snapshot` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_retail_order_items_order` (`order_id`),
  CONSTRAINT `fk_roi_order` FOREIGN KEY (`order_id`) REFERENCES `retail_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roi_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roi_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_roi_variant` FOREIGN KEY (`variant_id`) REFERENCES `retail_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Retail — Histórico de Transições de Status
CREATE TABLE IF NOT EXISTS `retail_order_status_history` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `from_status` ENUM('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NULL,
  `to_status` ENUM('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL,
  `changed_by_user_id` CHAR(36) NULL,
  `changed_by_name_snapshot` VARCHAR(150) NULL,
  `reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_retail_order_history_order_created` (`order_id`, `created_at`),
  CONSTRAINT `fk_rosh_order` FOREIGN KEY (`order_id`) REFERENCES `retail_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rosh_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
