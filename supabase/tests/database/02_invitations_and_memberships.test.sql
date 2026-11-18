-- ==============================================================================
-- DEVESSENT PLATFORM CORE — PGTAP SUITE 02: INVITATIONS & ATOMIC TENANT CREATION
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgtap";

SELECT plan(20);

-- Test 1: Verificar se a tabela tenant_invitations existe
SELECT has_table('public', 'tenant_invitations', 'Tabela tenant_invitations deve existir');

-- Test 2: Verificar se as colunas obrigatórias existem
SELECT columns_are(
    'public',
    'tenant_invitations',
    ARRAY['id', 'tenant_id', 'email', 'role', 'token_hash', 'invited_by', 'status', 'expires_at', 'created_at', 'updated_at'],
    'Colunas de tenant_invitations devem ser exatamente as especificadas'
);

-- Setup de usuários fictícios para os testes
INSERT INTO auth.users (id, email)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin.pgtap@devessent.test'),
    ('b0000000-0000-0000-0000-000000000002', 'owner.pgtap@devessent.test'),
    ('c0000000-0000-0000-0000-000000000003', 'member.pgtap@devessent.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_admins (user_id)
VALUES ('a0000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

-- Test 3: create_tenant_with_owner deve falhar se o autor não for platform_admin
SELECT throws_ok(
    $$ SELECT public.create_tenant_with_owner('Tenant Inválido', 'tenant-invalido', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002') $$,
    'Acesso negado: operação restrita a administradores da plataforma.',
    'create_tenant_with_owner deve rejeitar usuários não-administradores'
);

-- Test 4: create_tenant_with_owner deve criar atomicamente as 4 entidades quando autorizado
DO $$
DECLARE
    v_res JSONB;
    v_tid UUID;
BEGIN
    v_res := public.create_tenant_with_owner(
        'Empresa Atômica Teste',
        'empresa-atomica-teste',
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001'
    );
    v_tid := (v_res->>'id')::UUID;

    -- Salvar nas variáveis temporárias para assertions
    PERFORM set_config('vars.created_tenant_id', v_tid::text, true);
END $$;

SELECT is(
    (SELECT count(*)::integer FROM public.tenants WHERE slug = 'empresa-atomica-teste'),
    1,
    'Registro do tenant deve ter sido inserido'
);

-- Test 5: Proprietário vinculado em tenant_memberships
SELECT is(
    (SELECT role FROM public.tenant_memberships WHERE tenant_id = current_setting('vars.created_tenant_id')::UUID AND user_id = 'b0000000-0000-0000-0000-000000000002'),
    'owner'::membership_role,
    'Proprietário inicial deve ter sido vinculado com papel owner'
);

-- Test 6: Configurações criadas em tenant_settings
SELECT is(
    (SELECT display_name FROM public.tenant_settings WHERE tenant_id = current_setting('vars.created_tenant_id')::UUID),
    'Empresa Atômica Teste',
    'Configurações padrão devem ter sido inicializadas'
);

-- Test 7: Auditoria registrada em audit_logs
SELECT is(
    (SELECT action FROM public.audit_logs WHERE tenant_id = current_setting('vars.created_tenant_id')::UUID AND action = 'tenant.created'),
    'tenant.created',
    'Evento de auditoria imutável deve ter sido registrado'
);

-- Test 8: Constraint de convite não permite papel 'owner'
SELECT throws_ok(
    format($$
        INSERT INTO public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
        VALUES ('%s', 'teste@devessent.test', 'owner', 'hash123', 'b0000000-0000-0000-0000-000000000002')
    $$, current_setting('vars.created_tenant_id')),
    'new row for relation "tenant_invitations" violates check constraint "invitation_role_check"',
    'Convites não podem ter papel de proprietário (owner)'
);

-- Test 9: Inserir convite legítimo com papel 'staff'
SELECT lives_ok(
    format($$
        INSERT INTO public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
        VALUES ('%s', 'member.pgtap@devessent.test', 'staff', 'hash_valido_999', 'b0000000-0000-0000-0000-000000000002')
    $$, current_setting('vars.created_tenant_id')),
    'Inserção de convite para staff deve ser permitida'
);

-- Test 10: Bloquear duplicidade de convite pendente para o mesmo e-mail
SELECT throws_ok(
    format($$
        INSERT INTO public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
        VALUES ('%s', 'member.pgtap@devessent.test', 'manager', 'outro_hash_123', 'b0000000-0000-0000-0000-000000000002')
    $$, current_setting('vars.created_tenant_id')),
    'duplicate key value violates unique constraint "idx_unique_active_invitation"',
    'Não deve permitir convites pendentes duplicados para o mesmo e-mail no mesmo tenant'
);

-- Test 11: Bloquear e-mail em formato inválido
SELECT throws_ok(
    format($$
        INSERT INTO public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
        VALUES ('%s', 'email-invalido-sem-arroba', 'staff', 'hash_invalido_email', 'b0000000-0000-0000-0000-000000000002')
    $$, current_setting('vars.created_tenant_id')),
    'new row for relation "tenant_invitations" violates check constraint "valid_email_format"',
    'E-mails com formato inválido devem ser rejeitados'
);

-- Test 12: Trigger check_last_tenant_owner impede remover o único proprietário
SELECT throws_ok(
    format($$
        DELETE FROM public.tenant_memberships
        WHERE tenant_id = '%s' AND user_id = 'b0000000-0000-0000-0000-000000000002'
    $$, current_setting('vars.created_tenant_id')),
    'Operação negada: o estabelecimento não pode ficar sem nenhum proprietário.',
    'Remoção do único proprietário deve ser bloqueada pelo trigger'
);

-- Test 13: Trigger check_last_tenant_owner impede rebaixar o único proprietário a staff
SELECT throws_ok(
    format($$
        UPDATE public.tenant_memberships
        SET role = 'staff'
        WHERE tenant_id = '%s' AND user_id = 'b0000000-0000-0000-0000-000000000002'
    $$, current_setting('vars.created_tenant_id')),
    'Operação negada: o estabelecimento não pode ficar sem nenhum proprietário.',
    'Rebaixamento do único proprietário para staff deve ser bloqueado pelo trigger'
);

-- Test 14: Adicionar segundo owner permite remover o primeiro owner
SELECT lives_ok(
    format($$
        INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
        VALUES ('%s', 'c0000000-0000-0000-0000-000000000003', 'owner');
        DELETE FROM public.tenant_memberships
        WHERE tenant_id = '%s' AND user_id = 'b0000000-0000-0000-0000-000000000002';
    $$, current_setting('vars.created_tenant_id'), current_setting('vars.created_tenant_id')),
    'Remoção é permitida quando existe outro proprietário remanescente'
);

-- Test 15: O segundo owner agora é o último e não pode ser removido
SELECT throws_ok(
    format($$
        DELETE FROM public.tenant_memberships
        WHERE tenant_id = '%s' AND user_id = 'c0000000-0000-0000-0000-000000000003'
    $$, current_setting('vars.created_tenant_id')),
    'Operação negada: o estabelecimento não pode ficar sem nenhum proprietário.',
    'O proprietário remanescente agora não pode ser removido'
);

-- ==============================================================================
-- AUDITORIA DE CATÁLOGO E PRIVILÉGIOS (MIGRATION 005)
-- ==============================================================================

-- Test 16: authenticated NÃO deve ter permissão de execução em create_tenant_with_owner
SELECT ok(
    NOT has_function_privilege('authenticated', 'public.create_tenant_with_owner(text,text,uuid,uuid,text,text,text)', 'execute'),
    'authenticated NÃO deve ter privilégio EXECUTE em create_tenant_with_owner'
);

-- Test 17: anon NÃO deve ter permissão de execução em create_tenant_with_owner
SELECT ok(
    NOT has_function_privilege('anon', 'public.create_tenant_with_owner(text,text,uuid,uuid,text,text,text)', 'execute'),
    'anon NÃO deve ter privilégio EXECUTE em create_tenant_with_owner'
);

-- Test 18: service_role DEVE ter permissão de execução em create_tenant_with_owner
SELECT ok(
    has_function_privilege('service_role', 'public.create_tenant_with_owner(text,text,uuid,uuid,text,text,text)', 'execute'),
    'service_role DEVE ter privilégio EXECUTE em create_tenant_with_owner'
);

-- Test 19: authenticated NÃO deve ter execução direta na trigger check_last_tenant_owner
SELECT ok(
    NOT has_function_privilege('authenticated', 'public.check_last_tenant_owner()', 'execute'),
    'authenticated NÃO deve ter privilégio EXECUTE na trigger check_last_tenant_owner'
);

-- Test 20: authenticated DEVE ter permissão para aceitar convite próprio
SELECT ok(
    has_function_privilege('authenticated', 'public.accept_tenant_invitation(text,uuid)', 'execute'),
    'authenticated DEVE ter privilégio EXECUTE em accept_tenant_invitation'
);

SELECT * FROM finish();

ROLLBACK;

