-- ==============================================================================
-- DEVESSENT PLATFORM — MIGRATION XAMPP / MARIADB 003
-- FASE 6D: Pagamentos Retail, Conexões por Estabelecimento, Tentativas e Eventos
-- ==============================================================================

USE `devessent_test`;

-- 1. Colunas financeiras independentes em retail_orders
ALTER TABLE `retail_orders`
  ADD COLUMN IF NOT EXISTS `payment_status` ENUM(
    'not_started', 'pending', 'processing', 'paid', 'failed',
    'expired', 'cancelled', 'refunded', 'partially_refunded', 'disputed'
  ) NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS `shipping_fee_cents` INT NULL,
  ADD COLUMN IF NOT EXISTS `discount_cents` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `paid_amount_cents` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `refunded_amount_cents` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `paid_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `payment_share_token_hash` VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS `payment_share_expires_at` DATETIME NULL;

UPDATE `retail_orders`
   SET `shipping_fee_cents` = 0
 WHERE `delivery_mode` = 'pickup'
   AND `shipping_fee_cents` IS NULL;

-- 19. Conexões de Pagamento por Estabelecimento
CREATE TABLE IF NOT EXISTS `retail_payment_connections` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `provider` ENUM('mercado_pago', 'xampp_sandbox') NOT NULL DEFAULT 'xampp_sandbox',
  `environment` ENUM('sandbox') NOT NULL DEFAULT 'sandbox',
  `status` ENUM('connected', 'disconnected', 'expired', 'error') NOT NULL DEFAULT 'disconnected',
  `seller_account_id` VARCHAR(120) NULL,
  `seller_account_label` VARCHAR(180) NULL,
  `public_key` VARCHAR(255) NULL,
  `access_token_encrypted` TEXT NULL,
  `refresh_token_encrypted` TEXT NULL,
  `webhook_secret_encrypted` TEXT NULL,
  `token_expires_at` DATETIME NULL,
  `scopes_json` TEXT NOT NULL,
  `connected_by_user_id` CHAR(36) NULL,
  `connected_at` DATETIME NULL,
  `disconnected_at` DATETIME NULL,
  `last_verified_at` DATETIME NULL,
  `metadata_json` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rpc_tenant` (`tenant_id`),
  UNIQUE KEY `uq_rpc_store` (`store_id`),
  CONSTRAINT `fk_rpc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rpc_store` FOREIGN KEY (`store_id`) REFERENCES `retail_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Pagamentos Vinculados aos Pedidos
CREATE TABLE IF NOT EXISTS `retail_payments` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `connection_id` CHAR(36) NULL,
  `provider` ENUM('mercado_pago', 'xampp_sandbox') NOT NULL,
  `environment` ENUM('sandbox') NOT NULL DEFAULT 'sandbox',
  `external_payment_id` VARCHAR(128) NULL,
  `external_preference_id` VARCHAR(128) NULL,
  `external_reference` VARCHAR(255) NOT NULL,
  `seller_account_id` VARCHAR(120) NOT NULL,
  `currency` VARCHAR(5) NOT NULL DEFAULT 'BRL',
  `amount_cents` INT NOT NULL,
  `refunded_amount_cents` INT NOT NULL DEFAULT 0,
  `status` ENUM(
    'not_started', 'pending', 'processing', 'paid', 'failed',
    'expired', 'cancelled', 'refunded', 'partially_refunded', 'disputed'
  ) NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(40) NULL,
  `payment_method_label` VARCHAR(80) NULL,
  `checkout_url` VARCHAR(500) NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `payer_email_masked` VARCHAR(160) NULL,
  `divergence_alert` TEXT NULL,
  `approved_at` DATETIME NULL,
  `failed_at` DATETIME NULL,
  `expired_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  `refunded_at` DATETIME NULL,
  `last_reconciled_at` DATETIME NULL,
  `metadata_json` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rp_tenant_idempotency` (`tenant_id`, `idempotency_key`),
  UNIQUE KEY `uq_rp_provider_ext` (`provider`, `external_payment_id`),
  KEY `idx_rp_tenant_status` (`tenant_id`, `status`, `created_at`),
  KEY `idx_rp_order` (`order_id`),
  CONSTRAINT `fk_rp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_store` FOREIGN KEY (`store_id`) REFERENCES `retail_stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_order` FOREIGN KEY (`order_id`) REFERENCES `retail_orders` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Tentativas de Checkout
CREATE TABLE IF NOT EXISTS `retail_payment_attempts` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NOT NULL,
  `attempt_number` INT NOT NULL,
  `provider` ENUM('mercado_pago', 'xampp_sandbox') NOT NULL,
  `external_attempt_id` VARCHAR(128) NULL,
  `external_payment_id` VARCHAR(128) NULL,
  `amount_cents` INT NOT NULL,
  `currency` VARCHAR(5) NOT NULL DEFAULT 'BRL',
  `status` ENUM('pending', 'processing', 'paid', 'failed', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(40) NULL,
  `checkout_url` VARCHAR(500) NULL,
  `idempotency_key` VARCHAR(160) NOT NULL,
  `failure_code` VARCHAR(80) NULL,
  `failure_reason` TEXT NULL,
  `expires_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `metadata_json` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rpa_attempt` (`payment_id`, `attempt_number`),
  UNIQUE KEY `uq_rpa_idempotency` (`tenant_id`, `idempotency_key`),
  CONSTRAINT `fk_rpa_payment` FOREIGN KEY (`payment_id`) REFERENCES `retail_payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rpa_order` FOREIGN KEY (`order_id`) REFERENCES `retail_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Eventos e Webhooks Financeiros
CREATE TABLE IF NOT EXISTS `retail_payment_events` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NULL,
  `payment_id` CHAR(36) NULL,
  `provider` ENUM('mercado_pago', 'xampp_sandbox') NOT NULL,
  `external_event_id` VARCHAR(180) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `signature_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `processing_status` ENUM(
    'processed', 'ignored_duplicate', 'ignored_out_of_order',
    'rejected_divergence', 'failed_retryable'
  ) NOT NULL DEFAULT 'processed',
  `previous_status` VARCHAR(40) NULL,
  `new_status` VARCHAR(40) NULL,
  `amount_cents` INT NULL,
  `currency` VARCHAR(5) NULL,
  `payload_summary_json` TEXT NOT NULL,
  `error_message` TEXT NULL,
  `processed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rpe_provider_event` (`provider`, `external_event_id`),
  KEY `idx_rpe_payment` (`payment_id`, `created_at`),
  KEY `idx_rpe_tenant` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
