-- ==============================================================================
-- DEVESSENT PLATFORM CORE — MIGRATION 006: DYNAMIC TENANT BRANDING SETTINGS
-- Data: 2026-03-01
-- Descrição: Estende public.tenant_settings com metadados visuais estruturados e
--             validados no banco (segment_label, primary_color, monogram,
--             brand_description) para permitir identidade visual dinâmica por
--             estabelecimento sem presets hardcoded no código-fonte.
-- ==============================================================================

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS segment_label TEXT NOT NULL DEFAULT 'Operação Comercial',
  ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#6C5CE7',
  ADD COLUMN IF NOT EXISTS monogram TEXT,
  ADD COLUMN IF NOT EXISTS brand_description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_segment_label_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_segment_label_check
      CHECK (char_length(trim(segment_label)) BETWEEN 2 AND 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_primary_color_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_primary_color_check
      CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_monogram_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_monogram_check
      CHECK (monogram IS NULL OR monogram ~ '^[A-Z0-9]{1,3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_brand_description_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_brand_description_check
      CHECK (brand_description IS NULL OR char_length(brand_description) <= 240);
  END IF;
END $$;

