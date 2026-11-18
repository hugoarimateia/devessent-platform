-- DevEssent Platform — Fase 6A
-- Módulo Comercial Retail: Catálogo, Produtos, Variantes, Opções, Imagens e Configurações de Loja

-- 1. Tabela de Configuração da Loja Comercial Retail por Estabelecimento
CREATE TABLE IF NOT EXISTS public.retail_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  inventory_mode TEXT NOT NULL DEFAULT 'track_quantity' CHECK (inventory_mode IN ('track_quantity', 'untracked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Categorias do Catálogo Retail
CREATE TABLE IF NOT EXISTS public.retail_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_categories_tenant_slug UNIQUE (tenant_id, slug)
);

-- 3. Tabela de Produtos do Catálogo
CREATE TABLE IF NOT EXISTS public.retail_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_products_tenant_slug UNIQUE (tenant_id, slug)
);

-- 4. Associação Muitos-para-Muitos: Produtos e Categorias
CREATE TABLE IF NOT EXISTS public.retail_product_categories (
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.retail_categories(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

-- 5. Opções de Produto (ex.: Cor, Tamanho, Material)
CREATE TABLE IF NOT EXISTS public.retail_product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  values TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_product_options_product_name UNIQUE (product_id, name)
);

-- 6. Variantes de Produto com Preço em Centavos e Estoque
CREATE TABLE IF NOT EXISTS public.retail_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents INTEGER CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= price_cents),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  options_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_variants_tenant_sku UNIQUE (tenant_id, sku)
);

-- 7. Imagens dos Produtos no Catálogo
CREATE TABLE IF NOT EXISTS public.retail_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  variant_id UUID REFERENCES public.retail_variants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Índices de Desempenho e Integridade
CREATE INDEX IF NOT EXISTS idx_retail_stores_tenant ON public.retail_stores (tenant_id);
CREATE INDEX IF NOT EXISTS idx_retail_categories_tenant_sort ON public.retail_categories (tenant_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_retail_products_tenant_status ON public.retail_products (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_retail_products_tenant_created ON public.retail_products (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retail_product_categories_category ON public.retail_product_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_retail_variants_product ON public.retail_variants (product_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_retail_variants_tenant_sku ON public.retail_variants (tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_retail_product_images_product ON public.retail_product_images (product_id, sort_order ASC);

-- 9. Função de Verificação de Ativação do Retail
CREATE OR REPLACE FUNCTION public.is_retail_active(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.retail_stores s
    JOIN public.tenants t ON t.id = s.tenant_id
    WHERE s.tenant_id = p_tenant_id
      AND s.is_active = true
      AND t.status = 'active'
  );
$$;

-- 10. Habilitação de RLS em Todas as Tabelas Retail
ALTER TABLE public.retail_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_stores FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_product_categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_product_options FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_variants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_product_images FORCE ROW LEVEL SECURITY;

-- 11. Políticas RLS: public.retail_stores
CREATE POLICY retail_stores_select ON public.retail_stores
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR (is_active = true AND public.is_tenant_active(tenant_id))
  );

CREATE POLICY retail_stores_insert ON public.retail_stores
  FOR INSERT
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_stores_update ON public.retail_stores
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_stores_delete ON public.retail_stores
  FOR DELETE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 12. Políticas RLS: public.retail_categories
CREATE POLICY retail_categories_select ON public.retail_categories
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR (
      is_active = true
      AND public.is_retail_active(tenant_id)
    )
  );

CREATE POLICY retail_categories_insert ON public.retail_categories
  FOR INSERT
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_categories_update ON public.retail_categories
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_categories_delete ON public.retail_categories
  FOR DELETE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 13. Políticas RLS: public.retail_products
CREATE POLICY retail_products_select ON public.retail_products
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR (
      status = 'published'
      AND public.is_retail_active(tenant_id)
    )
  );

CREATE POLICY retail_products_insert ON public.retail_products
  FOR INSERT
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_products_update ON public.retail_products
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_products_delete ON public.retail_products
  FOR DELETE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 14. Políticas RLS: public.retail_product_categories
CREATE POLICY retail_prod_cat_select ON public.retail_product_categories
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR public.is_retail_active(tenant_id)
  );

CREATE POLICY retail_prod_cat_insert ON public.retail_product_categories
  FOR INSERT
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_prod_cat_delete ON public.retail_product_categories
  FOR DELETE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 15. Políticas RLS: public.retail_product_options
CREATE POLICY retail_options_select ON public.retail_product_options
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR public.is_retail_active(tenant_id)
  );

CREATE POLICY retail_options_write ON public.retail_product_options
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 16. Políticas RLS: public.retail_variants
CREATE POLICY retail_variants_select ON public.retail_variants
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR (
      is_available = true
      AND public.is_retail_active(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.retail_products p
        WHERE p.id = retail_variants.product_id
          AND p.status = 'published'
      )
    )
  );

CREATE POLICY retail_variants_insert ON public.retail_variants
  FOR INSERT
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_variants_update ON public.retail_variants
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_variants_delete ON public.retail_variants
  FOR DELETE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 17. Políticas RLS: public.retail_product_images
CREATE POLICY retail_images_select ON public.retail_product_images
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
    OR (
      public.is_retail_active(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.retail_products p
        WHERE p.id = retail_product_images.product_id
          AND p.status = 'published'
      )
    )
  );

CREATE POLICY retail_images_write ON public.retail_product_images
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- 18. Configuração do Bucket Supabase Storage 'retail-media'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'retail-media',
  'retail-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 19. Políticas de Segurança em storage.objects para 'retail-media'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'retail_media_public_select'
  ) THEN
    CREATE POLICY retail_media_public_select ON storage.objects
      FOR SELECT
      USING (bucket_id = 'retail-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'retail_media_tenant_upload'
  ) THEN
    CREATE POLICY retail_media_tenant_upload ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'retail-media'
        AND split_part(name, '/', 1) = 'retail'
        AND public.has_tenant_role((split_part(name, '/', 2))::uuid, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
        AND public.is_tenant_active((split_part(name, '/', 2))::uuid)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'retail_media_tenant_update'
  ) THEN
    CREATE POLICY retail_media_tenant_update ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'retail-media'
        AND split_part(name, '/', 1) = 'retail'
        AND public.has_tenant_role((split_part(name, '/', 2))::uuid, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
        AND public.is_tenant_active((split_part(name, '/', 2))::uuid)
      )
      WITH CHECK (
        bucket_id = 'retail-media'
        AND split_part(name, '/', 1) = 'retail'
        AND public.has_tenant_role((split_part(name, '/', 2))::uuid, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
        AND public.is_tenant_active((split_part(name, '/', 2))::uuid)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'retail_media_tenant_delete'
  ) THEN
    CREATE POLICY retail_media_tenant_delete ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'retail-media'
        AND split_part(name, '/', 1) = 'retail'
        AND public.has_tenant_role((split_part(name, '/', 2))::uuid, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
        AND public.is_tenant_active((split_part(name, '/', 2))::uuid)
      );
  END IF;
END $$;

