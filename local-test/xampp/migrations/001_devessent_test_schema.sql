-- ==============================================================================
-- DEVESSENT PLATFORM — SCHEMA DE TESTES LOCAIS XAMPP / MARIADB
-- Banco exclusivo de testes: devessent_test
-- NOTA: Este schema NÃO substitui o PostgreSQL/Supabase oficial.
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `devessent_test`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `devessent_test`;

-- 1. Usuários Demonstrativos Locais
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `avatar_path` VARCHAR(500) NULL,
  `is_platform_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Estabelecimentos (Tenants)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenants_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Vínculos e Papéis (RBAC)
CREATE TABLE IF NOT EXISTS `tenant_memberships` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('owner', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_membership_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_membership_user` (`user_id`),
  CONSTRAINT `fk_membership_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_membership_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Configurações e Branding Dinâmico
CREATE TABLE IF NOT EXISTS `tenant_settings` (
  `tenant_id` CHAR(36) NOT NULL,
  `segment_label` VARCHAR(80) NOT NULL DEFAULT 'Operação Comercial',
  `primary_color` VARCHAR(20) NOT NULL DEFAULT '#6C5CE7',
  `monogram` VARCHAR(10) NULL,
  `brand_description` VARCHAR(250) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`),
  CONSTRAINT `fk_settings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Convites Demonstrativos
CREATE TABLE IF NOT EXISTS `tenant_invitations` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` ENUM('owner', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  `token_hash` VARCHAR(128) NOT NULL,
  `status` ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invitations_tenant_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_invitations_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Logs de Auditoria de Teste
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NULL,
  `actor_user_id` CHAR(36) NULL,
  `action` VARCHAR(120) NOT NULL,
  `resource_type` VARCHAR(80) NOT NULL,
  `resource_id` VARCHAR(120) NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_tenant_created` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Retail — Lojas
CREATE TABLE IF NOT EXISTS `retail_stores` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `currency` VARCHAR(5) NOT NULL DEFAULT 'BRL',
  `template` ENUM('editorial', 'experimental') NOT NULL DEFAULT 'editorial',
  `brand_headline` VARCHAR(200) NULL,
  `brand_subheadline` VARCHAR(255) NULL,
  `about_text` TEXT NULL,
  `hero_badge` VARCHAR(80) NULL,
  `accent_color` VARCHAR(20) DEFAULT '#111111',
  `secondary_color` VARCHAR(20) DEFAULT '#f4f3f0',
  `announcement_bar` VARCHAR(255) NULL,
  `contact_email` VARCHAR(255) NULL,
  `contact_phone` VARCHAR(50) NULL,
  `social_links_json` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `inventory_mode` ENUM('track_quantity', 'untracked') NOT NULL DEFAULT 'track_quantity',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_stores_tenant` (`tenant_id`),
  UNIQUE KEY `uq_retail_stores_slug` (`slug`),
  CONSTRAINT `fk_retail_stores_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Retail — Categorias
CREATE TABLE IF NOT EXISTS `retail_categories` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_cat_tenant_slug` (`tenant_id`, `slug`),
  CONSTRAINT `fk_retail_cat_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Retail — Produtos
CREATE TABLE IF NOT EXISTS `retail_products` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  `published_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_retail_prod_tenant_slug` (`tenant_id`, `slug`),
  KEY `idx_retail_prod_tenant_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_retail_prod_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Retail — Produtos x Categorias
CREATE TABLE IF NOT EXISTS `retail_product_categories` (
  `product_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`product_id`, `category_id`),
  CONSTRAINT `fk_rpc_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rpc_category` FOREIGN KEY (`category_id`) REFERENCES `retail_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Retail — Opções
CREATE TABLE IF NOT EXISTS `retail_product_options` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `values_json` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rpo_product_name` (`product_id`, `name`),
  CONSTRAINT `fk_rpo_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Retail — Variantes
CREATE TABLE IF NOT EXISTS `retail_variants` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `sku` VARCHAR(80) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `compare_at_price_cents` INT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `options_summary_json` JSON NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rv_tenant_sku` (`tenant_id`, `sku`),
  CONSTRAINT `fk_rv_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Retail — Imagens Locais de Demonstração
CREATE TABLE IF NOT EXISTS `retail_product_images` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `variant_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_rpi_product` FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

