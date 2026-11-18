-- DevEssent Platform — Fase 6B
-- Módulo Comercial Retail: Configurações de Vitrine Pública (Storefront), Identidade de Marca e Resolução Segura

-- 1. Estender a tabela retail_stores com campos de vitrine e slug público
ALTER TABLE public.retail_stores
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS brand_headline TEXT,
  ADD COLUMN IF NOT EXISTS brand_subheadline TEXT,
  ADD COLUMN IF NOT EXISTS about_text TEXT,
  ADD COLUMN IF NOT EXISTS hero_badge TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_path TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#f4f3f0',
  ADD COLUMN IF NOT EXISTS announcement_bar TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{"instagram": "", "tiktok": "", "youtube": "", "twitter": ""}'::jsonb;

-- 2. Sincronizar slug inicial a partir de public.tenants para os registros existentes
UPDATE public.retail_stores s
SET slug = t.slug
FROM public.tenants t
WHERE s.tenant_id = t.id AND s.slug IS NULL;

-- 3. Definir restrições de integridade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retail_stores_slug_format_check'
  ) THEN
    ALTER TABLE public.retail_stores
      ADD CONSTRAINT retail_stores_slug_format_check
      CHECK (
        slug ~* '^[a-z0-9]+(-[a-z0-9]+)*$' AND
        char_length(slug) >= 3 AND
        char_length(slug) <= 50
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retail_stores_template_check'
  ) THEN
    ALTER TABLE public.retail_stores
      ADD CONSTRAINT retail_stores_template_check
      CHECK (template IN ('editorial', 'experimental'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retail_stores_accent_color_check'
  ) THEN
    ALTER TABLE public.retail_stores
      ADD CONSTRAINT retail_stores_accent_color_check
      CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retail_stores_secondary_color_check'
  ) THEN
    ALTER TABLE public.retail_stores
      ADD CONSTRAINT retail_stores_secondary_color_check
      CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

-- 4. Índice exclusivo e de busca rápida para resolução de slug público
CREATE UNIQUE INDEX IF NOT EXISTS idx_retail_stores_slug ON public.retail_stores (slug);
CREATE INDEX IF NOT EXISTS idx_retail_stores_active_slug ON public.retail_stores (slug) WHERE is_active = true;

-- 5. Função Trigger para manter slug sincronizado com o tenant quando não fornecido explicitamente
CREATE OR REPLACE FUNCTION public.handle_retail_store_slug_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    SELECT t.slug INTO NEW.slug
    FROM public.tenants t
    WHERE t.id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retail_store_slug_sync ON public.retail_stores;
CREATE TRIGGER trg_retail_store_slug_sync
  BEFORE INSERT OR UPDATE ON public.retail_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_retail_store_slug_sync();

-- 6. Função RPC de Resolução Pública de Vitrine (Zero Vazamento de Dados Administrativos)
CREATE OR REPLACE FUNCTION public.get_public_storefront(p_slug TEXT)
RETURNS TABLE (
  store_id UUID,
  tenant_id UUID,
  slug TEXT,
  store_name TEXT,
  currency TEXT,
  template TEXT,
  brand_headline TEXT,
  brand_subheadline TEXT,
  about_text TEXT,
  hero_badge TEXT,
  hero_image_path TEXT,
  accent_color TEXT,
  secondary_color TEXT,
  announcement_bar TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  social_links JSONB,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS store_id,
    s.tenant_id,
    s.slug,
    s.store_name,
    s.currency,
    s.template,
    s.brand_headline,
    s.brand_subheadline,
    s.about_text,
    s.hero_badge,
    s.hero_image_path,
    s.accent_color,
    s.secondary_color,
    s.announcement_bar,
    s.contact_email,
    s.contact_phone,
    s.social_links,
    s.is_active
  FROM public.retail_stores s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.slug = p_slug
    AND s.is_active = true
    AND t.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_storefront(TEXT) TO anon, authenticated;

