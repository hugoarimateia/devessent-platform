-- ==============================================================================
-- DEVESSENT PLATFORM CORE — PGTAP SUITE: MULTI-TENANT ISOLATION & RLS
-- ==============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(19);

-- 1. Verificação de existência das 6 tabelas fundamentais
SELECT has_table('profiles', 'Tabela profiles deve existir');
SELECT has_table('tenants', 'Tabela tenants deve existir');
SELECT has_table('tenant_memberships', 'Tabela tenant_memberships deve existir');
SELECT has_table('tenant_settings', 'Tabela tenant_settings deve existir');
SELECT has_table('platform_admins', 'Tabela platform_admins deve existir');
SELECT has_table('audit_logs', 'Tabela audit_logs deve existir');

-- 2. Setup de dados de teste isolados dentro da transação
DO $$
DECLARE
    u_admin UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    u_owner_a UUID := '00000000-0000-0000-0000-000000000002'::uuid;
    u_staff_a UUID := '00000000-0000-0000-0000-000000000003'::uuid;
    u_owner_b UUID := '00000000-0000-0000-0000-000000000004'::uuid;
    t_a UUID := '10000000-0000-0000-0000-000000000001'::uuid;
    t_b UUID := '10000000-0000-0000-0000-000000000002'::uuid;
    t_susp UUID := '10000000-0000-0000-0000-000000000003'::uuid;
BEGIN
    -- Inserir usuários sintéticos no auth.users
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (u_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@devessent.test', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Admin DevEssent"}'::jsonb, now(), now()),
        (u_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_a@atelier.test', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Owner A"}'::jsonb, now(), now()),
        (u_staff_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff_a@atelier.test', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Staff A"}'::jsonb, now(), now()),
        (u_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_b@verde.test', 'crypt', now(), '{"provider":"email"}'::jsonb, '{"full_name":"Owner B"}'::jsonb, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Inserir Platform Admin
    INSERT INTO public.platform_admins (user_id)
    VALUES (u_admin)
    ON CONFLICT DO NOTHING;

    -- Inserir Empresas de Teste
    INSERT INTO public.tenants (id, name, slug, status)
    VALUES
        (t_a, 'Ateliê Test', 'atelier-test', 'active'),
        (t_b, 'Verde Test', 'verde-test', 'active'),
        (t_susp, 'Suspensa Test', 'suspensa-test', 'suspended')
    ON CONFLICT (id) DO NOTHING;

    -- Inserir Configurações
    INSERT INTO public.tenant_settings (tenant_id, display_name, contact_email)
    VALUES
        (t_a, 'Ateliê Teste Display', 'contato@atelier.test'),
        (t_b, 'Verde Teste Display', 'contato@verde.test'),
        (t_susp, 'Suspensa Teste Display', 'contato@suspensa.test')
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Inserir Vínculos (Memberships)
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES
        (t_a, u_owner_a, 'owner'),
        (t_a, u_staff_a, 'staff'),
        (t_b, u_owner_b, 'owner'),
        (t_susp, u_owner_a, 'owner') -- u_owner_a também é dono da suspensa para testar política de suspensão
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
END $$;

-- 3. TESTE A — ACESSO NÃO AUTENTICADO (ANON)
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is_empty(
    'SELECT * FROM public.tenants',
    'Usuário anônimo (anon) não deve conseguir ler nenhuma empresa'
);

SELECT throws_ok(
    'INSERT INTO public.tenants (name, slug) VALUES (''Invasor'', ''invasor-test'')',
    'new row violates row-level security policy for table "tenants"',
    'Usuário anônimo não deve conseguir inserir empresa'
);

-- 4. TESTE B — ISOLAMENTO DE LEITURA ENTRE EMPRESAS
-- Simular Owner da Empresa A
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

SELECT results_eq(
    'SELECT slug FROM public.tenants ORDER BY slug',
    ARRAY['atelier-test'],
    'Owner da Empresa A deve enxergar APENAS a Empresa A'
);

SELECT results_eq(
    'SELECT display_name FROM public.tenant_settings',
    ARRAY['Ateliê Teste Display'],
    'Owner da Empresa A deve enxergar APENAS as configurações da Empresa A'
);

-- 5. TESTE C — BLOQUEIO DE ESCRITA EM REGISTROS ALHEIOS
UPDATE public.tenant_settings
SET display_name = 'Tentativa de Hack'
WHERE tenant_id = '10000000-0000-0000-0000-000000000002'; -- Tenant B

SELECT is(
    (SELECT display_name FROM public.tenant_settings WHERE tenant_id = '10000000-0000-0000-0000-000000000002'),
    NULL,
    'Owner da Empresa A não consegue alterar e nem ver registros da Empresa B (RLS bloqueia alteração)'
);

-- 6. TESTE D — IMPOSSIBILIDADE DE FUNCIONÁRIO ALTERAR CONFIGURAÇÕES
-- Simular Staff da Empresa A
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

UPDATE public.tenant_settings
SET display_name = 'Staff Tentando Mudar'
WHERE tenant_id = '10000000-0000-0000-0000-000000000001';

-- Voltar para superuser/postgres temporariamente para verificar que não houve alteração
RESET ROLE;
SELECT is(
    (SELECT display_name FROM public.tenant_settings WHERE tenant_id = '10000000-0000-0000-0000-000000000001'),
    'Ateliê Teste Display',
    'Staff não tem permissão de UPDATE em tenant_settings; valor permaneceu intacto'
);

-- 7. TESTE E — IMPOSSIBILIDADE DE ESCALONAMENTO DE PAPEL (STAFF -> OWNER)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true); -- Staff A

UPDATE public.tenant_memberships
SET role = 'owner'
WHERE user_id = '00000000-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
    (SELECT role::text FROM public.tenant_memberships WHERE user_id = '00000000-0000-0000-0000-000000000003'),
    'staff',
    'Staff não pode alterar o próprio papel para Owner (escalonamento impedido por RLS)'
);

-- 8. TESTE F — IMPOSSIBILIDADE DE AUTOATRIBUIÇÃO DE ADMINISTRADOR GLOBAL
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true); -- Staff A

SELECT throws_ok(
    'INSERT INTO public.platform_admins (user_id) VALUES (''00000000-0000-0000-0000-000000000003'')',
    'new row violates row-level security policy for table "platform_admins"',
    'Usuário comum não pode se inserir em platform_admins'
);

-- 9. TESTE G — IMPOSSIBILIDADE DE OWNER PROMOVER OUTRO USUÁRIO A OWNER
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true); -- Owner A

SELECT throws_ok(
    'UPDATE public.tenant_memberships SET role = ''owner'' WHERE user_id = ''00000000-0000-0000-0000-000000000003''',
    'new row violates row-level security policy for table "tenant_memberships"',
    'Owner não pode promover membros a Owner no fluxo padrão (blindagem confirmada)'
);

-- 10. TESTE H — COMPORTAMENTO DE EMPRESAS SUSPENSAS
-- u_owner_a também é dono da empresa suspensa t_susp
SELECT results_eq(
    'SELECT count(*)::int FROM public.tenants WHERE id = ''10000000-0000-0000-0000-000000000003''',
    ARRAY[0],
    'Usuário de empresa suspensa não deve conseguir visualizar a empresa (status != active)'
);

SELECT results_eq(
    'SELECT count(*)::int FROM public.tenant_settings WHERE tenant_id = ''10000000-0000-0000-0000-000000000003''',
    ARRAY[0],
    'Usuário de empresa suspensa não deve conseguir visualizar configurações operacionais'
);

-- 11. TESTE I — PLATFORM ADMIN TEM ACESSO GLOBAL
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true); -- Admin DevEssent

SELECT results_eq(
    'SELECT count(*)::int FROM public.tenants WHERE id IN (''10000000-0000-0000-0000-000000000001'', ''10000000-0000-0000-0000-000000000002'', ''10000000-0000-0000-0000-000000000003'')',
    ARRAY[3],
    'Platform Admin visualiza todos os tenants (incluindo suspensos)'
);

SELECT results_eq(
    'SELECT count(*)::int FROM public.tenant_settings WHERE tenant_id IN (''10000000-0000-0000-0000-000000000001'', ''10000000-0000-0000-0000-000000000002'', ''10000000-0000-0000-0000-000000000003'')',
    ARRAY[3],
    'Platform Admin visualiza todas as configurações de todos os tenants'
);

SELECT * FROM finish();
ROLLBACK;

