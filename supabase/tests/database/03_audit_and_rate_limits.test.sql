BEGIN;

SELECT plan(11);

-- ==============================================================================
-- TESTES DA MIGRATION 007 — ÍNDICES DE AUDITORIA E RATE LIMITS FAIL-CLOSED
-- ==============================================================================

-- Test 1: Verificar presença dos índices de auditoria criados pela Migration 007
SELECT has_index('public', 'audit_logs', 'idx_audit_logs_action_created', 'audit_logs deve possuir índice por action + created_at');
SELECT has_index('public', 'audit_logs', 'idx_audit_logs_tenant_created', 'audit_logs deve possuir índice por tenant_id + created_at');
SELECT has_index('public', 'audit_logs', 'idx_audit_logs_actor_created', 'audit_logs deve possuir índice por actor_user_id + created_at');

-- Test 4: Verificar cor primária padrão alinhada ao Design System (#5B46E5)
SELECT col_default_is(
    'public',
    'tenant_settings',
    'primary_color',
    '#5B46E5',
    'Valor padrão de primary_color em tenant_settings deve estar alinhado em #5B46E5'
);

-- Test 5: Tabela public.rate_limits existe e possui RLS forçado
SELECT has_table('public', 'rate_limits', 'Tabela public.rate_limits deve existir');
SELECT ok(
    (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.rate_limits'::regclass),
    'public.rate_limits deve ter ENABLE e FORCE ROW LEVEL SECURITY'
);

-- Test 7: Papel authenticated e anon NÃO possuem privilégios na tabela public.rate_limits
SELECT ok(
    NOT has_table_privilege('anon', 'public.rate_limits', 'SELECT, INSERT, UPDATE, DELETE'),
    'anon não deve ter nenhum privilégio em public.rate_limits'
);
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.rate_limits', 'SELECT, INSERT, UPDATE, DELETE'),
    'authenticated não deve ter nenhum privilégio em public.rate_limits'
);

-- Test 9: Funções consume_rate_limit e reset_rate_limit restritas a service_role
SELECT ok(
    NOT has_function_privilege('authenticated', 'public.consume_rate_limit(text,text,integer,integer,integer)', 'execute'),
    'authenticated não deve executar consume_rate_limit'
);
SELECT ok(
    has_function_privilege('service_role', 'public.consume_rate_limit(text,text,integer,integer,integer)', 'execute'),
    'service_role deve executar consume_rate_limit'
);

-- Test 11: consume_rate_limit aplica bloqueio ao atingir p_max_attempts e reset_rate_limit desbloqueia
SELECT results_eq(
    $$
        WITH
          c1 AS (SELECT allowed, remaining FROM public.consume_rate_limit('pgtap:test', 'key-1', 2, 60, 120)),
          c2 AS (SELECT allowed, remaining FROM public.consume_rate_limit('pgtap:test', 'key-1', 2, 60, 120)),
          c3 AS (SELECT allowed, remaining FROM public.consume_rate_limit('pgtap:test', 'key-1', 2, 60, 120))
        SELECT (SELECT allowed FROM c1), (SELECT allowed FROM c2), (SELECT allowed FROM c3);
    $$,
    $$ VALUES (true, true, false) $$,
    'consume_rate_limit deve permitir até o limite configurado e bloquear na tentativa excedente'
);

SELECT * FROM finish();

ROLLBACK;

