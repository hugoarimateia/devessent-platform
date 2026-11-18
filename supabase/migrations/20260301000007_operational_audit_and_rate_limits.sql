-- DevEssent Platform Core — Fase 5B
-- Índices operacionais para auditoria, alinhamento de cor padrão e rate limit durável em PostgreSQL

-- 1. Índices operacionais para consulta paginada e filtrada em public.audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON public.audit_logs (actor_user_id, created_at DESC);

-- 2. Alinhar o valor padrão da cor primária em tenant_settings ao Design System (#5B46E5)
ALTER TABLE public.tenant_settings
  ALTER COLUMN primary_color SET DEFAULT '#5B46E5';

-- 3. Tabela durável de controle de taxa / proteção anti-abuso (acesso restrito ao service_role)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, identifier)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;

-- Fail-closed total: nenhuma policy para anon/authenticated; acesso direto bloqueado.
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- 4. Função atômica para consultar/consumir janela de rate limit sem race condition
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_scope TEXT,
  p_identifier TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_row public.rate_limits%ROWTYPE;
  v_window INTERVAL := make_interval(secs => GREATEST(1, p_window_seconds));
  v_block INTERVAL := make_interval(secs => GREATEST(1, p_block_seconds));
BEGIN
  IF COALESCE(trim(p_scope), '') = '' OR COALESCE(trim(p_identifier), '') = '' THEN
    RAISE EXCEPTION 'Scope e identifier são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_max_attempts, 0) < 1 THEN
    RAISE EXCEPTION 'p_max_attempts deve ser maior ou igual a 1.' USING ERRCODE = '22023';
  END IF;

  -- Higienização oportunista de registros expirados há mais de 7 dias
  DELETE FROM public.rate_limits
  WHERE updated_at < v_now - INTERVAL '7 days';

  INSERT INTO public.rate_limits (scope, identifier, attempts, window_started_at, blocked_until, updated_at)
  VALUES (p_scope, p_identifier, 0, v_now, NULL, v_now)
  ON CONFLICT (scope, identifier) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.rate_limits
  WHERE scope = p_scope AND identifier = p_identifier
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN QUERY SELECT
      false,
      0,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INTEGER);
    RETURN;
  END IF;

  IF (v_row.window_started_at + v_window <= v_now)
     OR (v_row.blocked_until IS NOT NULL AND v_row.blocked_until <= v_now) THEN
    UPDATE public.rate_limits
    SET attempts = 1,
        window_started_at = v_now,
        blocked_until = NULL,
        updated_at = v_now
    WHERE scope = p_scope AND identifier = p_identifier;

    RETURN QUERY SELECT true, GREATEST(0, p_max_attempts - 1), 0;
    RETURN;
  END IF;

  IF v_row.attempts >= p_max_attempts THEN
    UPDATE public.rate_limits
    SET attempts = v_row.attempts + 1,
        blocked_until = v_now + v_block,
        updated_at = v_now
    WHERE scope = p_scope AND identifier = p_identifier;

    RETURN QUERY SELECT false, 0, GREATEST(1, p_block_seconds);
    RETURN;
  END IF;

  UPDATE public.rate_limits
  SET attempts = v_row.attempts + 1,
      updated_at = v_now
  WHERE scope = p_scope AND identifier = p_identifier;

  RETURN QUERY SELECT true, GREATEST(0, p_max_attempts - (v_row.attempts + 1)), 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_rate_limit(
  p_scope TEXT,
  p_identifier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE scope = p_scope AND identifier = p_identifier;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_rate_limit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(TEXT, TEXT) TO service_role;

