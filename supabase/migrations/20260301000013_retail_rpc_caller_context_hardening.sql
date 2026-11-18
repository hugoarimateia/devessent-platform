-- ==============================================================================
-- DEVESSENT PLATFORM — FASE 6C.2: AUDITORIA E BLINDAGEM DO CONTEXTO DE CHAMADA DAS RPCs
-- Migration aditiva oficial (PostgreSQL / Supabase Cloud)
-- Corrige o uso de `current_user` dentro de funções SECURITY DEFINER:
--   - Em funções SECURITY DEFINER, `current_user` reflete o proprietário da função
--     (ex.: postgres), não o chamador original da requisição.
--   - Esta migration substitui integralmente a validação de contexto por:
--     1. Verificação estrita de `auth.role()` e `auth.uid()` para PostgREST JWT.
--     2. Permissão administrativa direta apenas quando não há claims JWT
--        (`request.jwt.claims` vazio e `auth.role() IS NULL`) E `session_user`
--        pertence explicitamente a role administrativo de manutenção.
--   - Qualifica `public.membership_role[]` explicitamente sob `SET search_path = pg_catalog, public`.
-- ==============================================================================

-- 1. Hardening definitivo de confirm_retail_order (sem dependência de current_user)
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

-- 2. Hardening definitivo de cancel_retail_order (sem dependência de current_user)
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
    v_order.id, p_tenant_id, v_prev_status, 'cancelled', v_effective_actor_id, COALESCE(NULLIF(trim(p_actor_name), ''), 'Gestor'), v_order.cancellation_reason
  );

  RETURN v_order;
END;
$$;

-- 3. Hardening definitivo de transition_retail_order_status (sem dependência de current_user)
CREATE OR REPLACE FUNCTION public.transition_retail_order_status(
  p_tenant_id UUID,
  p_order_id UUID,
  p_next_status TEXT,
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
  v_prev_status TEXT;
  v_allowed BOOLEAN := false;
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
  IF p_next_status = 'confirmed' THEN
    RETURN public.confirm_retail_order(p_tenant_id, p_order_id, p_actor_user_id, p_actor_name, p_reason);
  ELSIF p_next_status = 'cancelled' THEN
    RETURN public.cancel_retail_order(p_tenant_id, p_order_id, p_actor_user_id, p_actor_name, COALESCE(p_reason, 'Cancelado pela equipe da loja'));
  END IF;

  IF p_next_status NOT IN ('preparing', 'ready', 'completed') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Status de destino inválido (%).', p_next_status;
  END IF;

  IF v_auth_role = 'anon' THEN
    RAISE EXCEPTION 'FORBIDDEN: Chamadas anônimas não podem alterar pedidos.';
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
      RAISE EXCEPTION 'FORBIDDEN: Papel do usuário não possui permissão para alterar status de pedidos.';
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
  v_allowed := (
    (v_prev_status = 'confirmed' AND p_next_status IN ('preparing', 'ready', 'completed'))
    OR (v_prev_status = 'preparing' AND p_next_status IN ('ready', 'completed'))
    OR (v_prev_status = 'ready' AND p_next_status = 'completed')
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Transição não permitida de "%" para "%".', v_prev_status, p_next_status;
  END IF;

  UPDATE public.retail_orders
     SET status = p_next_status,
         completed_at = CASE WHEN p_next_status = 'completed' THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = v_order.id
     AND tenant_id = p_tenant_id
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, p_tenant_id, v_prev_status, p_next_status, v_effective_actor_id, COALESCE(NULLIF(trim(p_actor_name), ''), 'Gestor'), NULLIF(trim(p_reason), '')
  );

  RETURN v_order;
END;
$$;

-- 4. Hardening definitivo de create_public_retail_order (exclusiva de service_role / sessão admin direta)
CREATE OR REPLACE FUNCTION public.create_public_retail_order(
  p_store_slug TEXT,
  p_cart_token_hash TEXT,
  p_order_number TEXT,
  p_public_token_hash TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_delivery_mode TEXT DEFAULT 'pickup',
  p_delivery_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_store RECORD;
  v_cart public.retail_carts%ROWTYPE;
  v_existing public.retail_orders%ROWTYPE;
  v_order public.retail_orders%ROWTYPE;
  v_subtotal_cents INTEGER := 0;
  v_item_count INTEGER := 0;
  v_item RECORD;
  v_line_total INTEGER;
  v_auth_role TEXT := NULLIF(auth.role(), '');
  v_jwt_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  v_is_direct_admin_session BOOLEAN := (
    v_auth_role IS NULL
    AND v_jwt_claims IS NULL
    AND session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF v_auth_role IS DISTINCT FROM 'service_role' AND NOT v_is_direct_admin_session THEN
    RAISE EXCEPTION 'FORBIDDEN: Operação pública controlada exclusiva de serviço autorizado.';
  END IF;

  SELECT s.id, s.tenant_id, s.store_name, s.slug, s.currency, s.inventory_mode, s.contact_phone
    INTO v_store
    FROM public.retail_stores s
    JOIN public.tenants t ON t.id = s.tenant_id
   WHERE s.slug = p_store_slug
     AND s.is_active = true
     AND t.status = 'active'
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORE_UNAVAILABLE: Loja indisponível ou suspensa no momento.';
  END IF;

  SELECT *
    INTO v_cart
    FROM public.retail_carts
   WHERE tenant_id = v_store.tenant_id
     AND store_id = v_store.id
     AND cart_token_hash = p_cart_token_hash
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CART_EMPTY: Sua sacola está vazia ou não foi localizada.';
  END IF;

  IF NULLIF(trim(p_idempotency_key), '') IS NOT NULL THEN
    SELECT *
      INTO v_existing
      FROM public.retail_orders
     WHERE tenant_id = v_store.tenant_id
       AND cart_id = v_cart.id
       AND idempotency_key = p_idempotency_key
     LIMIT 1;

    IF FOUND THEN
      UPDATE public.retail_orders
         SET public_token_hash = p_public_token_hash,
             updated_at = now()
       WHERE id = v_existing.id
      RETURNING * INTO v_existing;

      RETURN jsonb_build_object(
        'deduplicated', true,
        'order', to_jsonb(v_existing),
        'storeName', v_store.store_name,
        'storeSlug', COALESCE(v_store.slug, p_store_slug),
        'contactPhone', v_store.contact_phone,
        'itemCount', 0
      );
    END IF;
  END IF;

  IF v_cart.status <> 'active' OR v_cart.expires_at <= now() THEN
    RAISE EXCEPTION 'CART_EXPIRED: Sua sacola expirou ou já foi finalizada. Adicione os itens novamente.';
  END IF;

  FOR v_item IN
    SELECT ci.id AS cart_item_id, ci.product_id, ci.variant_id, ci.quantity,
           rp.name AS product_name, rp.status AS product_status,
           rv.name AS variant_name, rv.sku, rv.price_cents, rv.stock_quantity, rv.is_available
      FROM public.retail_cart_items ci
      JOIN public.retail_products rp ON rp.id = ci.product_id AND rp.tenant_id = ci.tenant_id
      JOIN public.retail_variants rv ON rv.id = ci.variant_id AND rv.tenant_id = ci.tenant_id
     WHERE ci.cart_id = v_cart.id
       AND ci.tenant_id = v_store.tenant_id
     ORDER BY ci.created_at ASC
  LOOP
    IF v_item.product_status <> 'published' OR NOT v_item.is_available THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE: O item "%" (%) não está mais disponível no catálogo.',
        v_item.product_name, v_item.variant_name;
    END IF;

    IF v_item.quantity <= 0 OR v_item.quantity > 99 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: Quantidade inválida para "%".', v_item.product_name;
    END IF;

    IF v_store.inventory_mode = 'track_quantity' AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: Estoque insuficiente para "%" (%): disponível %, solicitado %.',
        v_item.product_name, v_item.variant_name, v_item.stock_quantity, v_item.quantity;
    END IF;

    IF v_item.price_cents < 0 THEN
      RAISE EXCEPTION 'INVALID_PRICE: Preço inválido no catálogo para "%".', v_item.product_name;
    END IF;

    v_line_total := v_item.price_cents * v_item.quantity;
    v_subtotal_cents := v_subtotal_cents + v_line_total;
    v_item_count := v_item_count + v_item.quantity;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY: Sua sacola está vazia. Adicione pelo menos um item para continuar.';
  END IF;

  INSERT INTO public.retail_orders (
    tenant_id, store_id, cart_id, order_number, public_token_hash, status,
    stock_deducted, channel, currency, subtotal_cents, total_cents,
    customer_name, customer_phone, customer_email, delivery_mode, delivery_address,
    notes, idempotency_key
  ) VALUES (
    v_store.tenant_id, v_store.id, v_cart.id, p_order_number, p_public_token_hash, 'requested',
    false, 'storefront', v_store.currency, v_subtotal_cents, v_subtotal_cents,
    trim(p_customer_name), trim(p_customer_phone), NULLIF(trim(p_customer_email), ''),
    p_delivery_mode,
    CASE WHEN p_delivery_mode = 'delivery' THEN NULLIF(trim(p_delivery_address), '') ELSE NULL END,
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_idempotency_key), '')
  )
  RETURNING * INTO v_order;

  INSERT INTO public.retail_order_items (
    order_id, tenant_id, product_id, variant_id, product_name_snapshot,
    variant_name_snapshot, sku_snapshot, unit_price_cents, quantity,
    line_total_cents, image_url_snapshot
  )
  SELECT v_order.id, v_store.tenant_id, ci.product_id, ci.variant_id,
         rp.name, rv.name, rv.sku, rv.price_cents, ci.quantity,
         (rv.price_cents * ci.quantity),
         (
           SELECT rpi.storage_path
             FROM public.retail_product_images rpi
            WHERE rpi.product_id = rp.id AND rpi.tenant_id = v_store.tenant_id
            ORDER BY (rpi.variant_id = rv.id) DESC, rpi.is_primary DESC, rpi.sort_order ASC
            LIMIT 1
         )
    FROM public.retail_cart_items ci
    JOIN public.retail_products rp ON rp.id = ci.product_id AND rp.tenant_id = ci.tenant_id
    JOIN public.retail_variants rv ON rv.id = ci.variant_id AND rv.tenant_id = ci.tenant_id
   WHERE ci.cart_id = v_cart.id
     AND ci.tenant_id = v_store.tenant_id;

  INSERT INTO public.retail_order_status_history (
    order_id, tenant_id, from_status, to_status, changed_by_user_id, changed_by_name_snapshot, reason
  ) VALUES (
    v_order.id, v_store.tenant_id, NULL, 'requested', NULL, trim(p_customer_name), 'Solicitação enviada pela vitrine pública'
  );

  UPDATE public.retail_carts
     SET status = 'converted',
         updated_at = now()
   WHERE id = v_cart.id;

  RETURN jsonb_build_object(
    'deduplicated', false,
    'order', to_jsonb(v_order),
    'storeName', v_store.store_name,
    'storeSlug', COALESCE(v_store.slug, p_store_slug),
    'contactPhone', v_store.contact_phone,
    'itemCount', v_item_count
  );
END;
$$;

-- 5. Garantir revogação estrita e privilégios explícitos em todas as RPCs da Fase 6C/6C.1/6C.2
REVOKE ALL ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_retail_order_status(UUID, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_public_retail_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_retail_order(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_retail_order_status(UUID, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_public_retail_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
