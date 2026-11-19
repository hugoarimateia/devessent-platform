-- ==============================================================================
-- DEVESSENT PLATFORM — FASE 6D: PAGAMENTOS RETAIL, CHECKOUT FINANCEIRO E GOVERNANÇA
-- Migration aditiva oficial (PostgreSQL / Supabase Cloud)
-- ==============================================================================
-- Entregas:
--   1. Colunas financeiras independentes em retail_orders (payment_status, shipping_fee_cents,
--      discount_cents, paid_amount_cents, refunded_amount_cents, paid_at, link opaco de cobrança).
--   2. Tabelas financeiras multiempresa com RLS + FORCE ROW LEVEL SECURITY:
--      - retail_payment_connections (credenciais criptografadas, sem SELECT direto via PostgREST)
--      - retail_payments
--      - retail_payment_attempts
--      - retail_payment_events
--   3. RPCs transacionais SECURITY DEFINER sem dependência de current_user:
--      - get_retail_payment_connection_summary
--      - set_retail_order_shipping_fee
--      - create_retail_payment_session_tx (exclusiva de service_role)
--      - reconcile_retail_payment_tx (exclusiva de service_role)
--      - record_retail_payment_refund_tx (exclusiva de service_role)
--      - expire_or_cancel_retail_payment_tx (exclusiva de service_role)
--   4. Blindagem de confirm_retail_order e cancel_retail_order para proteger estoque
--      quando há pagamento em processamento ou já confirmado.
-- ==============================================================================

-- 1. Evolução aditiva de public.retail_orders (separação estrita entre pedido e pagamento)
ALTER TABLE public.retail_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (payment_status IN (
      'not_started', 'pending', 'processing', 'paid', 'failed',
      'expired', 'cancelled', 'refunded', 'partially_refunded', 'disputed'
    )),
  ADD COLUMN IF NOT EXISTS shipping_fee_cents INTEGER NULL
    CHECK (shipping_fee_cents IS NULL OR shipping_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (discount_cents >= 0),
  ADD COLUMN IF NOT EXISTS paid_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (paid_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (refunded_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_share_token_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_share_expires_at TIMESTAMPTZ NULL;

-- Pedidos de retirada presencial (pickup) não possuem frete a combinar (frete = 0 determinado)
UPDATE public.retail_orders
   SET shipping_fee_cents = 0
 WHERE delivery_mode = 'pickup'
   AND shipping_fee_cents IS NULL;

CREATE INDEX IF NOT EXISTS idx_retail_orders_tenant_payment_status
  ON public.retail_orders (tenant_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retail_orders_payment_share_token
  ON public.retail_orders (store_id, payment_share_token_hash)
  WHERE payment_share_token_hash IS NOT NULL;

-- 2. Conexões de conta de pagamento por estabelecimento (1 conta recebedora por loja/tenant)
CREATE TABLE IF NOT EXISTS public.retail_payment_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL UNIQUE REFERENCES public.retail_stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('mercado_pago', 'xampp_sandbox')),
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment = 'sandbox'),
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  seller_account_id TEXT NULL,
  seller_account_label TEXT NULL,
  public_key TEXT NULL,
  access_token_encrypted TEXT NULL,
  refresh_token_encrypted TEXT NULL,
  webhook_secret_encrypted TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_by_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NULL,
  disconnected_at TIMESTAMPTZ NULL,
  last_verified_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_retail_payment_connections_updated_at ON public.retail_payment_connections;
CREATE TRIGGER trg_retail_payment_connections_updated_at
  BEFORE UPDATE ON public.retail_payment_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

-- 3. Registros principais de pagamento vinculados aos pedidos
CREATE TABLE IF NOT EXISTS public.retail_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.retail_orders(id) ON DELETE RESTRICT,
  connection_id UUID NULL REFERENCES public.retail_payment_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL
    CHECK (provider IN ('mercado_pago', 'xampp_sandbox')),
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment = 'sandbox'),
  external_payment_id TEXT NULL,
  external_preference_id TEXT NULL,
  external_reference TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL'
    CHECK (currency = 'BRL'),
  amount_cents INTEGER NOT NULL
    CHECK (amount_cents > 0),
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'not_started', 'pending', 'processing', 'paid', 'failed',
      'expired', 'cancelled', 'refunded', 'partially_refunded', 'disputed'
    )),
  payment_method TEXT NULL
    CHECK (payment_method IS NULL OR payment_method IN (
      'pix', 'credit_card', 'debit_card', 'account_money', 'boleto', 'hosted_checkout', 'other'
    )),
  payment_method_label TEXT NULL,
  checkout_url TEXT NULL,
  idempotency_key TEXT NOT NULL,
  payer_email_masked TEXT NULL,
  divergence_alert TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  last_reconciled_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_payments_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- Um mesmo identificador externo de transação não pode ser vinculado a dois pagamentos/pedidos
CREATE UNIQUE INDEX IF NOT EXISTS uq_retail_payments_provider_ext_id
  ON public.retail_payments (provider, external_payment_id)
  WHERE external_payment_id IS NOT NULL;

-- Um mesmo pedido nunca pode possuir mais de um pagamento confirmado/pago ativo
CREATE UNIQUE INDEX IF NOT EXISTS uq_retail_payments_active_paid_order
  ON public.retail_payments (order_id)
  WHERE status IN ('paid', 'partially_refunded', 'disputed');

CREATE INDEX IF NOT EXISTS idx_retail_payments_tenant_status_created
  ON public.retail_payments (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retail_payments_order
  ON public.retail_payments (order_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_retail_payments_updated_at ON public.retail_payments;
CREATE TRIGGER trg_retail_payments_updated_at
  BEFORE UPDATE ON public.retail_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

-- 4. Tentativas e sessões de checkout vinculadas ao pagamento
CREATE TABLE IF NOT EXISTS public.retail_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.retail_orders(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.retail_payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'xampp_sandbox')),
  external_attempt_id TEXT NULL,
  external_payment_id TEXT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'expired', 'cancelled')),
  payment_method TEXT NULL,
  checkout_url TEXT NULL,
  idempotency_key TEXT NOT NULL,
  failure_code TEXT NULL,
  failure_reason TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_payment_attempts_number UNIQUE (payment_id, attempt_number),
  CONSTRAINT uq_retail_payment_attempts_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_retail_payment_attempts_payment
  ON public.retail_payment_attempts (payment_id, attempt_number DESC);

DROP TRIGGER IF EXISTS trg_retail_payment_attempts_updated_at ON public.retail_payment_attempts;
CREATE TRIGGER trg_retail_payment_attempts_updated_at
  BEFORE UPDATE ON public.retail_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

-- 5. Eventos financeiros, notificações de webhook e reconciliações
CREATE TABLE IF NOT EXISTS public.retail_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.retail_orders(id) ON DELETE SET NULL,
  payment_id UUID NULL REFERENCES public.retail_payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'xampp_sandbox')),
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'processed'
    CHECK (processing_status IN (
      'processed', 'ignored_duplicate', 'ignored_out_of_order',
      'rejected_divergence', 'failed_retryable'
    )),
  previous_status TEXT NULL,
  new_status TEXT NULL,
  amount_cents INTEGER NULL,
  currency TEXT NULL,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_payment_events_provider_ext_id UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_retail_payment_events_payment_created
  ON public.retail_payment_events (payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retail_payment_events_tenant_created
  ON public.retail_payment_events (tenant_id, created_at DESC);

-- 6. RLS + FORCE ROW LEVEL SECURITY nas 4 novas tabelas financeiras
ALTER TABLE public.retail_payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_payment_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_payment_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.retail_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_payment_events FORCE ROW LEVEL SECURITY;

-- Nota: retail_payment_connections NÃO possui policy SELECT direta para authenticated/anon
-- para impedir que colunas *_encrypted sejam lidas pelo PostgREST no cliente.
-- A leitura do estado da conexão ocorre exclusivamente via get_retail_payment_connection_summary.

DROP POLICY IF EXISTS retail_payments_tenant_select ON public.retail_payments;
CREATE POLICY retail_payments_tenant_select ON public.retail_payments
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_tenant_active(tenant_id)
      AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::public.membership_role[])
    )
  );

DROP POLICY IF EXISTS retail_payment_attempts_tenant_select ON public.retail_payment_attempts;
CREATE POLICY retail_payment_attempts_tenant_select ON public.retail_payment_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_tenant_active(tenant_id)
      AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::public.membership_role[])
    )
  );

DROP POLICY IF EXISTS retail_payment_events_tenant_select ON public.retail_payment_events;
CREATE POLICY retail_payment_events_tenant_select ON public.retail_payment_events
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_tenant_active(tenant_id)
      AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::public.membership_role[])
    )
  );

-- 7. RPC segura para consultar o resumo comercial da conexão de pagamento (Zero Segredos)
CREATE OR REPLACE FUNCTION public.get_retail_payment_connection_summary(
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  store_id UUID,
  provider TEXT,
  environment TEXT,
  status TEXT,
  seller_account_id TEXT,
  seller_account_label TEXT,
  public_key TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_auth_uid UUID := auth.uid();
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_auth_role = 'anon' THEN
    RAISE EXCEPTION 'FORBIDDEN: Acesso anônimo não permitido.';
  END IF;

  IF v_auth_role = 'authenticated' THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sessão inválida.';
    END IF;
    IF NOT (
      public.is_platform_admin(v_auth_uid)
      OR (
        public.is_tenant_active(p_tenant_id)
        AND public.has_tenant_role(p_tenant_id, v_auth_uid, ARRAY['owner', 'manager']::public.membership_role[])
      )
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Sem permissão para consultar conexão financeira deste estabelecimento.';
    END IF;
  ELSIF v_auth_role IS DISTINCT FROM 'service_role' AND NOT v_is_direct_admin_session THEN
    RAISE EXCEPTION 'FORBIDDEN: Contexto não autorizado.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.tenant_id,
    c.store_id,
    c.provider,
    c.environment,
    c.status,
    c.seller_account_id,
    c.seller_account_label,
    c.public_key,
    c.token_expires_at,
    c.connected_at,
    c.disconnected_at,
    c.last_verified_at
  FROM public.retail_payment_connections c
  WHERE c.tenant_id = p_tenant_id
  LIMIT 1;
END;
$$;

-- 8. RPC para definir/confirmar valor de frete e determinar total final do pedido (§8)
CREATE OR REPLACE FUNCTION public.set_retail_order_shipping_fee(
  p_tenant_id UUID,
  p_order_id UUID,
  p_shipping_fee_cents INTEGER,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'Gestor'
)
RETURNS public.retail_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.retail_orders%ROWTYPE;
  v_new_total INTEGER;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_auth_uid UUID := auth.uid();
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
  v_effective_actor_id UUID;
BEGIN
  IF v_auth_role = 'anon' THEN
    RAISE EXCEPTION 'FORBIDDEN: Chamadas anônimas não podem definir frete.';
  END IF;

  IF v_auth_role = 'authenticated' THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sessão autenticada inválida.';
    END IF;
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'FORBIDDEN: Identidade do ator diverge da sessão autenticada.';
    END IF;
    v_effective_actor_id := v_auth_uid;
  ELSIF v_auth_role = 'service_role' OR v_is_direct_admin_session THEN
    v_effective_actor_id := COALESCE(v_auth_uid, p_actor_user_id);
  ELSE
    RAISE EXCEPTION 'FORBIDDEN: Contexto de execução não autorizado.';
  END IF;

  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode alterar pedidos.';
  END IF;

  IF v_auth_role = 'authenticated' OR v_effective_actor_id IS NOT NULL THEN
    IF NOT (
      public.has_tenant_role(p_tenant_id, v_effective_actor_id, ARRAY['owner', 'manager']::public.membership_role[])
      OR public.is_platform_admin(v_effective_actor_id)
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Papel do usuário não possui permissão para definir valores do pedido.';
    END IF;
  END IF;

  IF p_shipping_fee_cents IS NULL OR p_shipping_fee_cents < 0 OR p_shipping_fee_cents > 5000000 THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_FEE: Valor de frete inválido.';
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = p_order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido não encontrado.';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Não é possível alterar frete de pedido concluído ou cancelado.';
  END IF;

  IF v_order.payment_status IN ('paid', 'processing', 'partially_refunded', 'refunded', 'disputed') THEN
    RAISE EXCEPTION 'PAYMENT_LOCKED: Não é possível alterar o valor de um pedido com pagamento em processamento ou confirmado.';
  END IF;

  v_new_total := v_order.subtotal_cents + p_shipping_fee_cents - COALESCE(v_order.discount_cents, 0);
  IF v_new_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL: O valor total final do pedido deve ser maior que zero.';
  END IF;

  -- Invalida tentativas pendentes anteriores se o valor mudou (§8)
  UPDATE public.retail_payment_attempts
     SET status = 'cancelled',
         failure_reason = 'Valor do pedido atualizado pelo estabelecimento antes do pagamento',
         updated_at = now()
   WHERE order_id = v_order.id
     AND tenant_id = p_tenant_id
     AND status = 'pending';

  UPDATE public.retail_payments
     SET status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   WHERE order_id = v_order.id
     AND tenant_id = p_tenant_id
     AND status = 'pending';

  UPDATE public.retail_orders
     SET shipping_fee_cents = p_shipping_fee_cents,
         total_cents = v_new_total,
         payment_status = CASE WHEN payment_status = 'pending' THEN 'not_started' ELSE payment_status END,
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- 9. Atualizar confirm_retail_order para fixar shipping_fee_cents = 0 em pedidos pickup
CREATE OR REPLACE FUNCTION public.confirm_retail_order(
  p_tenant_id UUID,
  p_order_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'Sistema',
  p_reason TEXT DEFAULT NULL
)
RETURNS public.retail_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.retail_orders%ROWTYPE;
  v_inventory_mode TEXT;
  v_item RECORD;
  v_variant RECORD;
  v_should_deduct BOOLEAN;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_auth_uid UUID := auth.uid();
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
  v_effective_actor_id UUID;
BEGIN
  IF v_auth_role = 'anon' THEN
    RAISE EXCEPTION 'FORBIDDEN: Chamadas anônimas não podem confirmar pedidos.';
  END IF;

  IF v_auth_role = 'authenticated' THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sessão autenticada inválida.';
    END IF;
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'FORBIDDEN: Identidade do ator diverge da sessão autenticada.';
    END IF;
    v_effective_actor_id := v_auth_uid;
  ELSIF v_auth_role = 'service_role' OR v_is_direct_admin_session THEN
    v_effective_actor_id := COALESCE(v_auth_uid, p_actor_user_id);
  ELSE
    RAISE EXCEPTION 'FORBIDDEN: Contexto de execução não autorizado.';
  END IF;

  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode confirmar pedidos.';
  END IF;

  IF v_auth_role = 'authenticated' OR v_effective_actor_id IS NOT NULL THEN
    IF NOT (
      public.has_tenant_role(p_tenant_id, v_effective_actor_id, ARRAY['owner', 'manager']::public.membership_role[])
      OR public.is_platform_admin(v_effective_actor_id)
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Papel do usuário não possui permissão para confirmar pedidos.';
    END IF;
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = p_order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido não encontrado para este estabelecimento.';
  END IF;

  IF v_order.status <> 'requested' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Apenas pedidos em solicitação (requested) podem ser confirmados. Estado atual: %.', v_order.status;
  END IF;

  SELECT inventory_mode
    INTO v_inventory_mode
    FROM public.retail_stores
   WHERE id = v_order.store_id
     AND tenant_id = p_tenant_id;

  v_should_deduct := COALESCE(v_inventory_mode, 'track_quantity') = 'track_quantity';

  IF v_should_deduct AND NOT v_order.stock_deducted THEN
    FOR v_item IN
      SELECT oi.id, oi.variant_id, oi.product_name_snapshot, oi.variant_name_snapshot, oi.sku_snapshot, oi.quantity
        FROM public.retail_order_items oi
       WHERE oi.order_id = v_order.id
         AND oi.tenant_id = p_tenant_id
       ORDER BY oi.variant_id
    LOOP
      IF v_item.variant_id IS NULL THEN
        RAISE EXCEPTION 'VARIANT_UNAVAILABLE: O item "%" (%) não está mais vinculado a uma variante ativa.',
          v_item.product_name_snapshot, v_item.sku_snapshot;
      END IF;

      SELECT rv.id, rv.stock_quantity, rv.is_available, rp.status AS product_status
        INTO v_variant
        FROM public.retail_variants rv
        JOIN public.retail_products rp ON rp.id = rv.product_id
       WHERE rv.id = v_item.variant_id
         AND rv.tenant_id = p_tenant_id
       FOR UPDATE OF rv;

      IF NOT FOUND OR v_variant.product_status <> 'published' OR NOT v_variant.is_available THEN
        RAISE EXCEPTION 'VARIANT_UNAVAILABLE: O produto "%" (%) está indisponível para confirmação.',
          v_item.product_name_snapshot, v_item.variant_name_snapshot;
      END IF;

      IF v_variant.stock_quantity < v_item.quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Estoque insuficiente para "%" (%): solicitado %, disponível %.',
          v_item.product_name_snapshot, v_item.variant_name_snapshot, v_item.quantity, v_variant.stock_quantity;
      END IF;

      UPDATE public.retail_variants
         SET stock_quantity = stock_quantity - v_item.quantity,
             updated_at = now()
       WHERE id = v_variant.id
         AND tenant_id = p_tenant_id;
    END LOOP;
  END IF;

  UPDATE public.retail_orders
     SET status = 'confirmed',
         stock_deducted = CASE WHEN v_should_deduct THEN true ELSE v_order.stock_deducted END,
         shipping_fee_cents = CASE
           WHEN v_order.delivery_mode = 'pickup' AND v_order.shipping_fee_cents IS NULL THEN 0
           ELSE v_order.shipping_fee_cents
         END,
         confirmed_at = now(),
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, p_tenant_id, 'requested', 'confirmed', v_effective_actor_id, COALESCE(NULLIF(trim(p_actor_name), ''), 'Gestor'), COALESCE(NULLIF(trim(p_reason), ''), 'Pedido confirmado pela loja')
  );

  RETURN v_order;
END;
$$;

-- 10. Atualizar cancel_retail_order para proteger estoque quando há pagamento pago ou em processamento (§11 e §12)
CREATE OR REPLACE FUNCTION public.cancel_retail_order(
  p_tenant_id UUID,
  p_order_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'Sistema',
  p_reason TEXT DEFAULT 'Cancelado pela equipe da loja'
)
RETURNS public.retail_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.retail_orders%ROWTYPE;
  v_prev_status TEXT;
  v_item RECORD;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_auth_uid UUID := auth.uid();
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
  v_effective_actor_id UUID;
BEGIN
  IF v_auth_role = 'anon' THEN
    RAISE EXCEPTION 'FORBIDDEN: Chamadas anônimas não podem cancelar pedidos.';
  END IF;

  IF v_auth_role = 'authenticated' THEN
    IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: Sessão autenticada inválida.';
    END IF;
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_auth_uid THEN
      RAISE EXCEPTION 'FORBIDDEN: Identidade do ator diverge da sessão autenticada.';
    END IF;
    v_effective_actor_id := v_auth_uid;
  ELSIF v_auth_role = 'service_role' OR v_is_direct_admin_session THEN
    v_effective_actor_id := COALESCE(v_auth_uid, p_actor_user_id);
  ELSE
    RAISE EXCEPTION 'FORBIDDEN: Contexto de execução não autorizado.';
  END IF;

  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode alterar pedidos.';
  END IF;

  IF v_auth_role = 'authenticated' OR v_effective_actor_id IS NOT NULL THEN
    IF NOT (
      public.has_tenant_role(p_tenant_id, v_effective_actor_id, ARRAY['owner', 'manager']::public.membership_role[])
      OR public.is_platform_admin(v_effective_actor_id)
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Papel do usuário não possui permissão para cancelar pedidos.';
    END IF;
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = p_order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido não encontrado.';
  END IF;

  v_prev_status := v_order.status;

  IF v_prev_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Pedidos já concluídos não podem ser cancelados.';
  END IF;

  IF v_prev_status = 'cancelled' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: O pedido já está cancelado.';
  END IF;

  -- Proteção financeira (§11 e §12): não liberar estoque nem cancelar pedido com pagamento em processamento ou já aprovado sem reembolso confirmado
  IF v_order.payment_status = 'processing' THEN
    RAISE EXCEPTION 'PAYMENT_IN_PROCESSING: Há um pagamento em processamento para este pedido. Verifique o estado no provedor antes de cancelar.';
  END IF;

  IF v_order.payment_status IN ('paid', 'partially_refunded', 'disputed') THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_PAID: Pedido possui pagamento confirmado. Realize e confirme o reembolso total no provedor antes de cancelar o pedido.';
  END IF;

  IF v_order.stock_deducted THEN
    FOR v_item IN
      SELECT oi.variant_id, oi.quantity
        FROM public.retail_order_items oi
       WHERE oi.order_id = v_order.id
         AND oi.tenant_id = p_tenant_id
         AND oi.variant_id IS NOT NULL
       ORDER BY oi.variant_id
    LOOP
      UPDATE public.retail_variants
         SET stock_quantity = stock_quantity + v_item.quantity,
             updated_at = now()
       WHERE id = v_item.variant_id
         AND tenant_id = p_tenant_id;
    END LOOP;
  END IF;

  -- Cancela eventuais sessões financeiras pendentes
  UPDATE public.retail_payment_attempts
     SET status = 'cancelled',
         failure_reason = 'Pedido cancelado operacionalmente',
         updated_at = now()
   WHERE order_id = v_order.id
     AND tenant_id = p_tenant_id
     AND status = 'pending';

  UPDATE public.retail_payments
     SET status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   WHERE order_id = v_order.id
     AND tenant_id = p_tenant_id
     AND status = 'pending';

  UPDATE public.retail_orders
     SET status = 'cancelled',
         stock_deducted = false,
         payment_status = CASE WHEN payment_status = 'pending' THEN 'cancelled' ELSE payment_status END,
         cancelled_at = now(),
         cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelado pela equipe da loja'),
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, p_tenant_id, v_prev_status, 'cancelled', v_effective_actor_id, COALESCE(NULLIF(trim(p_actor_name), ''), 'Gestor'), v_order.cancellation_reason
  );

  RETURN v_order;
END;
$$;

-- 11. RPC transacional para criar/registrar sessão de pagamento online (exclusiva de service_role)
CREATE OR REPLACE FUNCTION public.create_retail_payment_session_tx(
  p_tenant_id UUID,
  p_order_id UUID,
  p_provider TEXT,
  p_seller_account_id TEXT,
  p_external_preference_id TEXT,
  p_external_reference TEXT,
  p_checkout_url TEXT,
  p_idempotency_key TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_payer_email_masked TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.retail_orders%ROWTYPE;
  v_conn public.retail_payment_connections%ROWTYPE;
  v_payment public.retail_payments%ROWTYPE;
  v_attempt public.retail_payment_attempts%ROWTYPE;
  v_next_attempt_num INTEGER;
  v_expected_total INTEGER;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_auth_role IS DISTINCT FROM 'service_role' AND NOT v_is_direct_admin_session THEN
    RAISE EXCEPTION 'FORBIDDEN: Criação transacional de sessão financeira exclusiva de serviço autorizado.';
  END IF;

  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode iniciar pagamentos.';
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = p_order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido não encontrado para este estabelecimento.';
  END IF;

  -- Regra §7: somente pedidos com disponibilidade já confirmada podem iniciar pagamento
  IF v_order.status NOT IN ('confirmed', 'preparing', 'ready') THEN
    RAISE EXCEPTION 'ORDER_NOT_CONFIRMED: Pagamento online disponível apenas para pedidos confirmados (status atual: %).', v_order.status;
  END IF;

  IF v_order.payment_status IN ('paid', 'partially_refunded', 'refunded', 'disputed') THEN
    RAISE EXCEPTION 'ORDER_ALREADY_PAID: Este pedido já possui pagamento confirmado.';
  END IF;

  -- Regra §8: valor de entrega deve ser conhecido quando delivery_mode = 'delivery'
  IF v_order.delivery_mode = 'delivery' AND v_order.shipping_fee_cents IS NULL THEN
    RAISE EXCEPTION 'UNDETERMINED_SHIPPING: O valor de entrega deste pedido ainda está a combinar. Defina o valor do frete antes de liberar o pagamento online.';
  END IF;

  v_expected_total := v_order.subtotal_cents + COALESCE(v_order.shipping_fee_cents, 0) - COALESCE(v_order.discount_cents, 0);
  IF v_expected_total <= 0 OR v_order.total_cents <> v_expected_total THEN
    RAISE EXCEPTION 'INVALID_ORDER_TOTAL: O total do pedido (%) diverge da soma validada (%).', v_order.total_cents, v_expected_total;
  END IF;

  IF v_order.currency <> 'BRL' THEN
    RAISE EXCEPTION 'UNSUPPORTED_CURRENCY: Moeda % não suportada para checkout.', v_order.currency;
  END IF;

  SELECT *
    INTO v_conn
    FROM public.retail_payment_connections
   WHERE tenant_id = p_tenant_id
     AND store_id = v_order.store_id
     AND status = 'connected'
     AND environment = 'sandbox'
   LIMIT 1;

  IF NOT FOUND OR COALESCE(NULLIF(trim(v_conn.seller_account_id), ''), '') = '' THEN
    RAISE EXCEPTION 'GATEWAY_NOT_CONNECTED: Estabelecimento não possui conta de pagamento conectada em modo Sandbox.';
  END IF;

  IF v_conn.seller_account_id <> p_seller_account_id THEN
    RAISE EXCEPTION 'SELLER_ACCOUNT_MISMATCH: Conta recebedora (%) diverge da conta conectada ao estabelecimento (%).',
      p_seller_account_id, v_conn.seller_account_id;
  END IF;

  -- Verifica idempotência da tentativa/pagamento
  SELECT *
    INTO v_payment
    FROM public.retail_payments
   WHERE tenant_id = p_tenant_id
     AND idempotency_key = p_idempotency_key
   LIMIT 1;

  IF FOUND THEN
    SELECT *
      INTO v_attempt
      FROM public.retail_payment_attempts
     WHERE payment_id = v_payment.id
     ORDER BY attempt_number DESC
     LIMIT 1;

    RETURN jsonb_build_object(
      'deduplicated', true,
      'payment', to_jsonb(v_payment),
      'attempt', to_jsonb(v_attempt)
    );
  END IF;

  -- Reutiliza pagamento aberto do pedido (se o valor e conta coincidirem) ou cria um novo registro principal
  SELECT *
    INTO v_payment
    FROM public.retail_payments
   WHERE tenant_id = p_tenant_id
     AND order_id = v_order.id
     AND status IN ('pending', 'failed', 'expired')
     AND amount_cents = v_order.total_cents
     AND seller_account_id = v_conn.seller_account_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.retail_payments (
      tenant_id, store_id, order_id, connection_id, provider, environment,
      external_preference_id, external_reference, seller_account_id,
      currency, amount_cents, status, payment_method, payment_method_label,
      checkout_url, idempotency_key, payer_email_masked, metadata
    ) VALUES (
      p_tenant_id, v_order.store_id, v_order.id, v_conn.id, p_provider, 'sandbox',
      p_external_preference_id, p_external_reference, v_conn.seller_account_id,
      v_order.currency, v_order.total_cents, 'pending', 'hosted_checkout', 'Checkout Pro',
      p_checkout_url, p_idempotency_key, p_payer_email_masked, COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_payment;
  ELSE
    -- Invalida tentativas pendentes anteriores antes de abrir a nova sessão
    UPDATE public.retail_payment_attempts
       SET status = 'expired',
           failure_reason = 'Nova sessão de checkout solicitada',
           updated_at = now()
     WHERE payment_id = v_payment.id
       AND status = 'pending';

    UPDATE public.retail_payments
       SET external_preference_id = p_external_preference_id,
           external_reference = p_external_reference,
           checkout_url = p_checkout_url,
           status = 'pending',
           failed_at = NULL,
           expired_at = NULL,
           metadata = COALESCE(v_payment.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
           updated_at = now()
     WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO v_next_attempt_num
    FROM public.retail_payment_attempts
   WHERE payment_id = v_payment.id;

  INSERT INTO public.retail_payment_attempts (
    tenant_id, store_id, order_id, payment_id, attempt_number, provider,
    external_attempt_id, amount_cents, currency, status, payment_method,
    checkout_url, idempotency_key, expires_at, metadata
  ) VALUES (
    p_tenant_id, v_order.store_id, v_order.id, v_payment.id, v_next_attempt_num, p_provider,
    p_external_preference_id, v_order.total_cents, v_order.currency, 'pending', 'hosted_checkout',
    p_checkout_url, p_idempotency_key || ':attempt:' || v_next_attempt_num, p_expires_at, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_attempt;

  UPDATE public.retail_orders
     SET payment_status = 'pending',
         updated_at = now()
   WHERE id = v_order.id;

  INSERT INTO public.retail_payment_events (
    tenant_id, store_id, order_id, payment_id, provider,
    external_event_id, event_type, signature_verified, processing_status,
    previous_status, new_status, amount_cents, currency, payload_summary
  ) VALUES (
    p_tenant_id, v_order.store_id, v_order.id, v_payment.id, p_provider,
    'session:' || v_attempt.id::text, 'payment.session_created', true, 'processed',
    v_order.payment_status, 'pending', v_order.total_cents, v_order.currency,
    jsonb_build_object('attemptNumber', v_next_attempt_num, 'externalPreferenceId', p_external_preference_id)
  )
  ON CONFLICT (provider, external_event_id) DO NOTHING;

  RETURN jsonb_build_object(
    'deduplicated', false,
    'payment', to_jsonb(v_payment),
    'attempt', to_jsonb(v_attempt)
  );
END;
$$;

-- 12. RPC transacional de reconciliação / processamento de webhook após consulta autoritativa no provedor
CREATE OR REPLACE FUNCTION public.reconcile_retail_payment_tx(
  p_tenant_id UUID,
  p_payment_id UUID,
  p_provider TEXT,
  p_external_event_id TEXT,
  p_event_type TEXT,
  p_signature_verified BOOLEAN,
  p_external_payment_id TEXT,
  p_external_reference TEXT,
  p_seller_account_id TEXT,
  p_authoritative_status TEXT,
  p_authoritative_amount_cents INTEGER,
  p_authoritative_currency TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_method_label TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_payload_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.retail_payments%ROWTYPE;
  v_order public.retail_orders%ROWTYPE;
  v_existing_event public.retail_payment_events%ROWTYPE;
  v_prev_status TEXT;
  v_divergence TEXT := NULL;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_auth_role IS DISTINCT FROM 'service_role' AND NOT v_is_direct_admin_session THEN
    RAISE EXCEPTION 'FORBIDDEN: Reconciliação financeira exclusiva de serviço autorizado.';
  END IF;

  -- 1. Idempotência de evento/webhook
  SELECT *
    INTO v_existing_event
    FROM public.retail_payment_events
   WHERE provider = p_provider
     AND external_event_id = p_external_event_id
   LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_payment FROM public.retail_payments WHERE id = p_payment_id AND tenant_id = p_tenant_id;
    RETURN jsonb_build_object(
      'outcome', 'ignored_duplicate',
      'payment', to_jsonb(v_payment),
      'eventId', v_existing_event.id
    );
  END IF;

  -- 2. Trava pagamento e pedido no tenant correto
  SELECT *
    INTO v_payment
    FROM public.retail_payments
   WHERE id = p_payment_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Registro financeiro não localizado para o estabelecimento.';
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = v_payment.order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Pedido vinculado ao pagamento não localizado.';
  END IF;

  v_prev_status := v_payment.status;

  -- 3. Validações estritas de integridade contra fraude / divergência (§5, §10, §17)
  IF COALESCE(p_seller_account_id, '') <> v_payment.seller_account_id THEN
    v_divergence := format('SELLER_MISMATCH: Conta recebedora informada (%s) diverge da conta do estabelecimento (%s).',
      COALESCE(p_seller_account_id, 'NULL'), v_payment.seller_account_id);
  ELSIF COALESCE(p_authoritative_currency, '') <> v_payment.currency THEN
    v_divergence := format('CURRENCY_MISMATCH: Moeda informada (%s) diverge da moeda do pedido (%s).',
      COALESCE(p_authoritative_currency, 'NULL'), v_payment.currency);
  ELSIF COALESCE(p_authoritative_amount_cents, -1) <> v_payment.amount_cents OR v_payment.amount_cents <> v_order.total_cents THEN
    v_divergence := format('AMOUNT_MISMATCH: Valor informado (%s) diverge do total validado do pedido (%s).',
      COALESCE(p_authoritative_amount_cents::text, 'NULL'), v_payment.amount_cents::text);
  ELSIF COALESCE(p_external_reference, '') <> '' AND p_external_reference <> v_payment.external_reference THEN
    v_divergence := format('REFERENCE_MISMATCH: Referência externa (%s) diverge da esperada (%s).',
      p_external_reference, v_payment.external_reference);
  ELSIF p_external_payment_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.retail_payments rp
     WHERE rp.provider = p_provider
       AND rp.external_payment_id = p_external_payment_id
       AND rp.id <> v_payment.id
  ) THEN
    v_divergence := format('DUPLICATE_EXTERNAL_PAYMENT_ID: Identificador externo %s já está associado a outro pagamento.',
      p_external_payment_id);
  END IF;

  IF v_divergence IS NOT NULL THEN
    UPDATE public.retail_payments
       SET divergence_alert = v_divergence,
           last_reconciled_at = now(),
           updated_at = now()
     WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    INSERT INTO public.retail_payment_events (
      tenant_id, store_id, order_id, payment_id, provider,
      external_event_id, event_type, signature_verified, processing_status,
      previous_status, new_status, amount_cents, currency, payload_summary, error_message
    ) VALUES (
      p_tenant_id, v_payment.store_id, v_order.id, v_payment.id, p_provider,
      p_external_event_id, 'payment.divergence_blocked', p_signature_verified, 'rejected_divergence',
      v_prev_status, v_prev_status, p_authoritative_amount_cents, p_authoritative_currency,
      COALESCE(p_payload_summary, '{}'::jsonb), v_divergence
    );

    RETURN jsonb_build_object(
      'outcome', 'rejected_divergence',
      'divergenceAlert', v_divergence,
      'payment', to_jsonb(v_payment)
    );
  END IF;

  -- 4. Proteção contra eventos fora de ordem: pagamento já pago/reembolsado não regride para pending/failed/expired
  IF v_prev_status IN ('paid', 'partially_refunded', 'refunded')
     AND p_authoritative_status IN ('pending', 'processing', 'failed', 'expired', 'cancelled') THEN
    INSERT INTO public.retail_payment_events (
      tenant_id, store_id, order_id, payment_id, provider,
      external_event_id, event_type, signature_verified, processing_status,
      previous_status, new_status, amount_cents, currency, payload_summary, error_message
    ) VALUES (
      p_tenant_id, v_payment.store_id, v_order.id, v_payment.id, p_provider,
      p_external_event_id, p_event_type, p_signature_verified, 'ignored_out_of_order',
      v_prev_status, v_prev_status, p_authoritative_amount_cents, p_authoritative_currency,
      COALESCE(p_payload_summary, '{}'::jsonb),
      format('Evento fora de ordem ignorado: estado atual %s não regride para %s.', v_prev_status, p_authoritative_status)
    );

    RETURN jsonb_build_object(
      'outcome', 'ignored_out_of_order',
      'payment', to_jsonb(v_payment)
    );
  END IF;

  -- 5. Proteção de aprovação tardia em pedido já cancelado (§11)
  IF v_order.status = 'cancelled' AND p_authoritative_status = 'paid' THEN
    v_divergence := 'LATE_APPROVAL_ON_CANCELLED_ORDER: Pagamento aprovado tardiamente no provedor após cancelamento do pedido. Revisão operacional e reembolso necessários.';
  END IF;

  -- 6. Atualiza pagamento, tentativa mais recente e status financeiro do pedido (NUNCA marca pedido como completed automaticamente!)
  UPDATE public.retail_payments
     SET external_payment_id = COALESCE(p_external_payment_id, external_payment_id),
         status = p_authoritative_status,
         payment_method = COALESCE(p_payment_method, payment_method),
         payment_method_label = COALESCE(p_payment_method_label, payment_method_label),
         divergence_alert = COALESCE(v_divergence, divergence_alert),
         approved_at = CASE WHEN p_authoritative_status = 'paid' THEN COALESCE(approved_at, now()) ELSE approved_at END,
         failed_at = CASE WHEN p_authoritative_status = 'failed' THEN now() ELSE failed_at END,
         expired_at = CASE WHEN p_authoritative_status = 'expired' THEN now() ELSE expired_at END,
         cancelled_at = CASE WHEN p_authoritative_status = 'cancelled' THEN now() ELSE cancelled_at END,
         last_reconciled_at = now(),
         updated_at = now()
   WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.retail_payment_attempts
     SET external_payment_id = COALESCE(p_external_payment_id, external_payment_id),
         status = CASE
           WHEN p_authoritative_status IN ('paid', 'failed', 'expired', 'cancelled', 'processing', 'pending')
             THEN p_authoritative_status
           ELSE status
         END,
         payment_method = COALESCE(p_payment_method, payment_method),
         failure_code = COALESCE(p_failure_code, failure_code),
         failure_reason = COALESCE(p_failure_reason, failure_reason),
         completed_at = CASE WHEN p_authoritative_status IN ('paid', 'failed', 'expired', 'cancelled') THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = (
     SELECT id
       FROM public.retail_payment_attempts
      WHERE payment_id = v_payment.id
      ORDER BY attempt_number DESC
      LIMIT 1
   );

  UPDATE public.retail_orders
     SET payment_status = p_authoritative_status,
         paid_amount_cents = CASE WHEN p_authoritative_status = 'paid' THEN v_payment.amount_cents ELSE paid_amount_cents END,
         paid_at = CASE WHEN p_authoritative_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
         updated_at = now()
   WHERE id = v_order.id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_payment_events (
    tenant_id, store_id, order_id, payment_id, provider,
    external_event_id, event_type, signature_verified, processing_status,
    previous_status, new_status, amount_cents, currency, payload_summary, error_message
  ) VALUES (
    p_tenant_id, v_payment.store_id, v_order.id, v_payment.id, p_provider,
    p_external_event_id, p_event_type, p_signature_verified, 'processed',
    v_prev_status, p_authoritative_status, p_authoritative_amount_cents, p_authoritative_currency,
    COALESCE(p_payload_summary, '{}'::jsonb), v_divergence
  );

  RETURN jsonb_build_object(
    'outcome', 'processed',
    'divergenceAlert', v_divergence,
    'payment', to_jsonb(v_payment),
    'orderPaymentStatus', v_order.payment_status,
    'orderOperationalStatus', v_order.status
  );
END;
$$;

-- 13. RPC transacional para registrar reembolso confirmado pelo provedor (§12)
CREATE OR REPLACE FUNCTION public.record_retail_payment_refund_tx(
  p_tenant_id UUID,
  p_payment_id UUID,
  p_provider TEXT,
  p_external_refund_id TEXT,
  p_refund_amount_cents INTEGER,
  p_reason TEXT DEFAULT 'Reembolso confirmado no provedor',
  p_actor_user_id UUID DEFAULT NULL,
  p_payload_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.retail_payments%ROWTYPE;
  v_order public.retail_orders%ROWTYPE;
  v_new_refunded INTEGER;
  v_next_status TEXT;
  v_prev_status TEXT;
  v_event_key TEXT;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_auth_role IS DISTINCT FROM 'service_role' AND NOT v_is_direct_admin_session THEN
    RAISE EXCEPTION 'FORBIDDEN: Registro de reembolso confirmado exclusivo de serviço autorizado.';
  END IF;

  IF COALESCE(NULLIF(trim(p_external_refund_id), ''), '') = '' THEN
    RAISE EXCEPTION 'INVALID_REFUND_CONFIRMATION: Identificador de confirmação de reembolso do provedor é obrigatório.';
  END IF;

  v_event_key := 'refund:' || trim(p_external_refund_id);

  IF EXISTS (
    SELECT 1 FROM public.retail_payment_events
     WHERE provider = p_provider AND external_event_id = v_event_key
  ) THEN
    SELECT * INTO v_payment FROM public.retail_payments WHERE id = p_payment_id AND tenant_id = p_tenant_id;
    RETURN jsonb_build_object('outcome', 'ignored_duplicate', 'payment', to_jsonb(v_payment));
  END IF;

  SELECT *
    INTO v_payment
    FROM public.retail_payments
   WHERE id = p_payment_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Pagamento não encontrado.';
  END IF;

  IF v_payment.status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'INVALID_REFUND_STATE: Apenas pagamentos aprovados podem ser reembolsados (status atual: %).', v_payment.status;
  END IF;

  IF p_refund_amount_cents <= 0 OR (v_payment.refunded_amount_cents + p_refund_amount_cents) > v_payment.amount_cents THEN
    RAISE EXCEPTION 'INVALID_REFUND_AMOUNT: Valor de reembolso (%) excede o saldo disponível (%).',
      p_refund_amount_cents, (v_payment.amount_cents - v_payment.refunded_amount_cents);
  END IF;

  SELECT *
    INTO v_order
    FROM public.retail_orders
   WHERE id = v_payment.order_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  v_prev_status := v_payment.status;
  v_new_refunded := v_payment.refunded_amount_cents + p_refund_amount_cents;
  v_next_status := CASE WHEN v_new_refunded >= v_payment.amount_cents THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE public.retail_payments
     SET refunded_amount_cents = v_new_refunded,
         status = v_next_status,
         refunded_at = now(),
         last_reconciled_at = now(),
         updated_at = now()
   WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.retail_orders
     SET refunded_amount_cents = v_new_refunded,
         payment_status = v_next_status,
         updated_at = now()
   WHERE id = v_order.id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_payment_events (
    tenant_id, store_id, order_id, payment_id, provider,
    external_event_id, event_type, signature_verified, processing_status,
    previous_status, new_status, amount_cents, currency, payload_summary
  ) VALUES (
    p_tenant_id, v_payment.store_id, v_order.id, v_payment.id, p_provider,
    v_event_key, 'payment.refunded', true, 'processed',
    v_prev_status, v_next_status, p_refund_amount_cents, v_payment.currency,
    COALESCE(p_payload_summary, '{}'::jsonb) || jsonb_build_object(
      'externalRefundId', p_external_refund_id,
      'reason', p_reason,
      'actorUserId', p_actor_user_id
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'processed',
    'payment', to_jsonb(v_payment),
    'orderPaymentStatus', v_order.payment_status
  );
END;
$$;

-- 14. Privilégios explícitos e revogação estrita
REVOKE ALL ON TABLE public.retail_payment_connections FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.retail_payments FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.retail_payment_attempts FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.retail_payment_events FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_retail_payment_connection_summary(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_retail_order_shipping_fee(UUID, UUID, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_retail_payment_session_tx(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_retail_payment_tx(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_retail_payment_refund_tx(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_retail_payment_connection_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_retail_order_shipping_fee(UUID, UUID, INTEGER, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_retail_payment_session_tx(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_retail_payment_tx(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_retail_payment_refund_tx(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, UUID, JSONB) TO service_role;
