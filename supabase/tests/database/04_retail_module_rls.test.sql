-- ==============================================================================
-- DEVESSENT PLATFORM — PGTAP SUITE: RETAIL MODULE CATALOG & RLS ISOLATION
-- ==============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(21);

-- 1. Verificação de existência das 7 tabelas do Retail
SELECT has_table('retail_stores', 'Tabela retail_stores deve existir');
SELECT has_table('retail_categories', 'Tabela retail_categories deve existir');
SELECT has_table('retail_products', 'Tabela retail_products deve existir');
SELECT has_table('retail_product_categories', 'Tabela retail_product_categories deve existir');
SELECT has_table('retail_product_options', 'Tabela retail_product_options deve existir');
SELECT has_table('retail_variants', 'Tabela retail_variants deve existir');
SELECT has_table('retail_product_images', 'Tabela retail_product_images deve existir');

-- 2. Verificação de funções e bucket de storage
SELECT has_function('is_retail_active', ARRAY['uuid'], 'Função is_retail_active(uuid) deve existir');
SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'retail-media' AND public = true),
  'Bucket retail-media deve existir no Supabase Storage e ser público'
);

-- 3. Setup de dados de teste isolados dentro da transação
DO $$
DECLARE
    u_owner_a UUID := '00000000-0000-0000-0000-000000000051'::uuid;
    u_staff_a UUID := '00000000-0000-0000-0000-000000000052'::uuid;
    u_owner_b UUID := '00000000-0000-0000-0000-000000000053'::uuid;
    t_a UUID := '10000000-0000-0000-0000-000000000051'::uuid;
    t_b UUID := '10000000-0000-0000-0000-000000000052'::uuid;
    p_a UUID := '20000000-0000-0000-0000-000000000051'::uuid;
    c_a UUID := '30000000-0000-0000-0000-000000000051'::uuid;
BEGIN
    -- Inserir usuários no auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (u_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_a_retail@test.local', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Owner A Retail"}'::jsonb, now(), now()),
        (u_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff_a_retail@test.local', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Staff A Retail"}'::jsonb, now(), now()),
        (u_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_b_retail@test.local', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Owner B Retail"}'::jsonb, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Inserir Tenants de Teste
    INSERT INTO public.tenants (id, name, slug, status)
    VALUES
        (t_a, 'Ateliê Retail Teste', 'atelie-retail-test', 'active'),
        (t_b, 'Verde Retail Teste', 'verde-retail-test', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Inserir Vínculos
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES
        (t_a, u_owner_a, 'owner'),
        (t_a, u_staff_a, 'staff'),
        (t_b, u_owner_b, 'owner')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    -- Ativar Loja Retail para Tenant A
    INSERT INTO public.retail_stores (tenant_id, store_name, currency, is_active)
    VALUES (t_a, 'Loja Ateliê', 'BRL', true)
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Inserir Categoria e Produto Base
    INSERT INTO public.retail_categories (id, tenant_id, name, slug)
    VALUES (c_a, t_a, 'Vestuário', 'vestuario')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.retail_products (id, tenant_id, name, slug, status)
    VALUES (p_a, t_a, 'Camiseta Linho', 'camiseta-linho', 'draft')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.retail_variants (tenant_id, product_id, sku, name, price_cents, stock_quantity)
    VALUES (t_a, p_a, 'SKU-TEE-M', 'M', 15900, 10)
    ON CONFLICT (tenant_id, sku) DO NOTHING;
END $$;

-- 4. Testes de Restrição e Integridade (Check Constraints e Unicidade)
SELECT throws_ok(
  $$ INSERT INTO public.retail_variants (tenant_id, product_id, sku, name, price_cents, stock_quantity)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, '20000000-0000-0000-0000-000000000051'::uuid, 'SKU-FAIL-NEG', 'Negativo', -500, 5) $$,
  '23514',
  NULL,
  'Preço negativo em variante deve violar check constraint'
);

SELECT throws_ok(
  $$ INSERT INTO public.retail_variants (tenant_id, product_id, sku, name, price_cents, stock_quantity)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, '20000000-0000-0000-0000-000000000051'::uuid, 'SKU-FAIL-STOCK', 'Estoque Neg', 1000, -2) $$,
  '23514',
  NULL,
  'Estoque negativo em variante deve violar check constraint'
);

SELECT throws_ok(
  $$ INSERT INTO public.retail_variants (tenant_id, product_id, sku, name, price_cents, stock_quantity)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, '20000000-0000-0000-0000-000000000051'::uuid, 'SKU-TEE-M', 'Duplicado', 19900, 5) $$,
  '23505',
  NULL,
  'SKU duplicado dentro da mesma empresa deve violar constraint de unicidade'
);

SELECT lives_ok(
  $$ INSERT INTO public.retail_variants (tenant_id, product_id, sku, name, price_cents, stock_quantity)
     VALUES ('10000000-0000-0000-0000-000000000052'::uuid, '20000000-0000-0000-0000-000000000051'::uuid, 'SKU-TEE-M', 'Mesmo SKU em Outro Tenant', 19900, 5) $$,
  'Mesmo SKU é permitido em empresas diferentes (unicidade escopada ao tenant_id)'
);

-- 5. Testes de RLS: Owner A acessando seu próprio catálogo
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '00000000-0000-0000-0000-000000000051';

SELECT ok(
  EXISTS (SELECT 1 FROM public.retail_products WHERE id = '20000000-0000-0000-0000-000000000051'::uuid),
  'Owner A consegue ler o produto (inclusive em rascunho) de sua própria empresa'
);

SELECT lives_ok(
  $$ INSERT INTO public.retail_categories (tenant_id, name, slug)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, 'Alfaiataria Nova', 'alfaiataria-nova') $$,
  'Owner A consegue criar categoria em sua própria empresa'
);

-- 6. Testes de RLS: Owner B tentando violar isolamento contra Tenant A
SET LOCAL "request.jwt.claim.sub" TO '00000000-0000-0000-0000-000000000053';

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.retail_products WHERE tenant_id = '10000000-0000-0000-0000-000000000051'::uuid),
  'Owner B NÃO consegue ler produtos em rascunho da Empresa A'
);

SELECT throws_ok(
  $$ INSERT INTO public.retail_categories (tenant_id, name, slug)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, 'Ataque B', 'ataque-b') $$,
  '42501',
  NULL,
  'Owner B é bloqueado pelo RLS ao tentar inserir categoria na Empresa A'
);

-- 7. Testes de RLS: Staff A (somente leitura operacional; escrita proibida)
SET LOCAL "request.jwt.claim.sub" TO '00000000-0000-0000-0000-000000000052';

SELECT ok(
  EXISTS (SELECT 1 FROM public.retail_products WHERE id = '20000000-0000-0000-0000-000000000051'::uuid),
  'Staff A consegue visualizar produtos de sua empresa'
);

SELECT throws_ok(
  $$ INSERT INTO public.retail_categories (tenant_id, name, slug)
     VALUES ('10000000-0000-0000-0000-000000000051'::uuid, 'Categoria Staff Proibida', 'cat-staff') $$,
  '42501',
  NULL,
  'Staff A é bloqueado pelo RLS ao tentar inserir categoria'
);

-- 8. Testes de RLS: Acesso Público / Anônimo
RESET ROLE;
-- Publicar o produto
UPDATE public.retail_products
SET status = 'published', published_at = now()
WHERE id = '20000000-0000-0000-0000-000000000051'::uuid;

-- Criar um produto rascunho adicional
INSERT INTO public.retail_products (tenant_id, name, slug, status)
VALUES ('10000000-0000-0000-0000-000000000051'::uuid, 'Rascunho Secreto', 'rascunho-secreto', 'draft');

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" TO '';

SELECT ok(
  EXISTS (SELECT 1 FROM public.retail_products WHERE slug = 'camiseta-linho' AND status = 'published'),
  'Usuário público/anônimo consegue consultar produto publicado de loja ativa'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.retail_products WHERE slug = 'rascunho-secreto'),
  'Usuário público/anônimo NÃO consegue consultar produtos em rascunho (draft)'
);

SELECT finish();
ROLLBACK;
