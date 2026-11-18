-- ==============================================================================
-- DEVESSENT PLATFORM — FASE 6C: CARRINHO, PEDIDOS E ESTOQUE TRANSACIONAL RETAIL
-- Migration aditiva oficial (PostgreSQL / Supabase)
-- Não altera ou remove estruturas existentes do Core ou das Fases 6A / 6B / 6B.1.
-- ==============================================================================

-- 1. Carrinhos persistentes isolados por estabelecimento/loja
CREATE TABLE IF NOT EXISTS public.retail_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE CASCADE,
  cart_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'converted', 'expired', 'abandoned')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_carts_tenant_token UNIQUE (tenant_id, cart_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_retail_carts_lookup
  ON public.retail_carts (store_id, cart_token_hash, status);

CREATE INDEX IF NOT EXISTS idx_retail_carts_expires
  ON public.retail_carts (status, expires_at);

-- 2. Itens do carrinho
CREATE TABLE IF NOT EXISTS public.retail_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.retail_carts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.retail_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 999),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_cart_items_variant UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_retail_cart_items_cart
  ON public.retail_cart_items (cart_id);

-- 3. Solicitações de pedido / Pedidos Retail (sem processamento de pagamento)
CREATE TABLE IF NOT EXISTS public.retail_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.retail_stores(id) ON DELETE RESTRICT,
  cart_id UUID NULL REFERENCES public.retail_carts(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  public_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  channel TEXT NOT NULL DEFAULT 'storefront'
    CHECK (channel IN ('storefront', 'manual')),
  currency TEXT NOT NULL DEFAULT 'BRL',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'pickup'
    CHECK (delivery_mode IN ('pickup', 'delivery')),
  delivery_address TEXT NULL,
  notes TEXT NULL,
  cancellation_reason TEXT NULL,
  idempotency_key TEXT NULL,
  confirmed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retail_orders_tenant_number UNIQUE (tenant_id, order_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_retail_orders_tenant_idempotency
  ON public.retail_orders (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_retail_orders_tenant_status_created
  ON public.retail_orders (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retail_orders_tenant_created
  ON public.retail_orders (tenant_id, created_at DESC);

-- 4. Snapshots imutáveis de itens do pedido
CREATE TABLE IF NOT EXISTS public.retail_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retail_orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NULL REFERENCES public.retail_products(id) ON DELETE SET NULL,
  variant_id UUID NULL REFERENCES public.retail_variants(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 999),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  image_url_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retail_order_items_order
  ON public.retail_order_items (order_id);

-- 5. Histórico auditável de transições de status
CREATE TABLE IF NOT EXISTS public.retail_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.retail_orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_status TEXT NULL
    CHECK (from_status IS NULL OR from_status IN ('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  to_status TEXT NOT NULL
    CHECK (to_status IN ('requested', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  changed_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name_snapshot TEXT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retail_order_history_order_created
  ON public.retail_order_status_history (order_id, created_at ASC);

-- 6. Triggers updated_at (reutilizando helper existente ou criando específico seguro)
CREATE OR REPLACE FUNCTION public.touch_retail_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retail_carts_updated_at ON public.retail_carts;
CREATE TRIGGER trg_retail_carts_updated_at
  BEFORE UPDATE ON public.retail_carts
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

DROP TRIGGER IF EXISTS trg_retail_cart_items_updated_at ON public.retail_cart_items;
CREATE TRIGGER trg_retail_cart_items_updated_at
  BEFORE UPDATE ON public.retail_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

DROP TRIGGER IF EXISTS trg_retail_orders_updated_at ON public.retail_orders;
CREATE TRIGGER trg_retail_orders_updated_at
  BEFORE UPDATE ON public.retail_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_retail_updated_at();

-- 7. Habilitar RLS em todas as tabelas da Fase 6C
ALTER TABLE public.retail_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_order_status_history ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS restritivas (zero vazamento público e isolamento estrito multiempresa)
-- Staff não possui permissão de visualização/gestão irrestrita nem mutação de pedidos.

-- retail_carts: apenas owner/manager/platform_admin do tenant (vitrine pública opera via servidor/service role)
CREATE POLICY retail_carts_admin_select ON public.retail_carts
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY retail_carts_admin_manage ON public.retail_carts
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY retail_cart_items_admin_select ON public.retail_cart_items
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY retail_cart_items_admin_manage ON public.retail_cart_items
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- retail_orders: histórico preservado para tenants ativos ou suspensos via SELECT de owner/manager/admin
CREATE POLICY retail_orders_tenant_select ON public.retail_orders
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY retail_orders_tenant_update ON public.retail_orders
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    AND public.is_tenant_active(tenant_id)
  );

-- retail_order_items
CREATE POLICY retail_order_items_tenant_select ON public.retail_order_items
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    OR public.is_platform_admin(auth.uid())
  );

-- retail_order_status_history
CREATE POLICY retail_order_history_tenant_select ON public.retail_order_status_history
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])
    OR public.is_platform_admin(auth.uid())
  );

-- 9. RPC Transacional: Confirmar pedido com trava de linha (FOR UPDATE) e baixa atômica de estoque
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
BEGIN
  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode confirmar pedidos.';
  END IF;

  -- Verifica permissão explícita se houver ator autenticado no contexto
  IF p_actor_user_id IS NOT NULL THEN
    IF NOT (
      public.has_tenant_role(p_tenant_id, p_actor_user_id, ARRAY['owner', 'manager']::membership_role[])
      OR public.is_platform_admin(p_actor_user_id)
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
         confirmed_at = now(),
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, p_tenant_id, 'requested', 'confirmed', p_actor_user_id, COALESCE(p_actor_name, 'Gestor'), COALESCE(p_reason, 'Pedido confirmado pela loja')
  );

  RETURN v_order;
END;
$$;

-- 10. RPC Transacional: Cancelar pedido com estorno único e idempotente de estoque
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
BEGIN
  IF NOT public.is_tenant_active(p_tenant_id) THEN
    RAISE EXCEPTION 'TENANT_SUSPENDED: Estabelecimento suspenso não pode alterar pedidos.';
  END IF;

  IF p_actor_user_id IS NOT NULL THEN
    IF NOT (
      public.has_tenant_role(p_tenant_id, p_actor_user_id, ARRAY['owner', 'manager']::membership_role[])
      OR public.is_platform_admin(p_actor_user_id)
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

  -- Estorna estoque uma única vez apenas se o pedido realmente havia baixado estoque
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

  UPDATE public.retail_orders
     SET status = 'cancelled',
         stock_deducted = false,
         cancelled_at = now(),
         cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelado pela equipe da loja'),
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, p_tenant_id, v_prev_status, 'cancelled', p_actor_user_id, COALESCE(p_actor_name, 'Gestor'), v_order.cancellation_reason
  );

  RETURN v_order;
END;
$$;

-- 11. Restrição estrita de privilégios nas funções transacionais
REVOKE ALL ON FUNCTION public.touch_retail_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
