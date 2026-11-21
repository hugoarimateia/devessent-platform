-- ==============================================================================
-- DEVESSENT PLATFORM — FASE 6E.2: BILLING SAAS, ASSINATURAS RECORRENTES E
-- CONTRATOS DE IMPLANTAÇÃO 50/50 (SEPARAÇÃO FINANCEIRA MULTIEMPRESA)
-- ==============================================================================
-- Regra Arquitetural Central:
--   - Fluxo A (Retail Payments): Consumidores -> Estabelecimentos (intocado).
--   - Fluxo B (Billing SaaS):    Empresários  -> DevEssent (mensalidades).
--   - Fluxo C (Implantação):     Empresários  -> DevEssent (parcelas manuais 50/50).
--
-- Esta migration é 100% aditiva e NÃO altera nenhuma tabela ou RPC do Retail.
-- ==============================================================================

-- 0. Função utilitária isolada de timestamp para tabelas Billing/Implantação
CREATE OR REPLACE FUNCTION public.touch_billing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 1. PLANOS COMERCIAIS SAAS (billing_plans + billing_plan_history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE
    CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name TEXT NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  description TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1
    CHECK (version >= 1),
  amount_cents INTEGER NOT NULL
    CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL'
    CHECK (currency = 'BRL'),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  included_services JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(included_services) = 'array'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_active
  ON public.billing_plans (is_active, created_at DESC);

DROP TRIGGER IF EXISTS trg_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER trg_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  action TEXT NOT NULL
    CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated')),
  previous_amount_cents INTEGER NULL,
  new_amount_cents INTEGER NOT NULL CHECK (new_amount_cents > 0),
  changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NULL,
  changed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_plan_history_plan
  ON public.billing_plan_history (plan_id, created_at DESC);

-- ==============================================================================
-- 2. ASSINATURAS RECORRENTES POR EMPRESA (billing_subscriptions + history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
  plan_name_snapshot TEXT NOT NULL,
  plan_version_snapshot INTEGER NOT NULL CHECK (plan_version_snapshot >= 1),
  contracted_amount_cents INTEGER NOT NULL CHECK (contracted_amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  status TEXT NOT NULL DEFAULT 'awaiting_authorization'
    CHECK (status IN (
      'awaiting_activation',
      'awaiting_authorization',
      'active',
      'pending_payment',
      'past_due',
      'in_regularization',
      'cancel_scheduled',
      'cancelled'
    )),
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment = 'sandbox'),
  provider TEXT NOT NULL DEFAULT 'mercado_pago'
    CHECK (provider IN ('mercado_pago', 'sandbox_simulator')),
  external_plan_id TEXT NULL,
  external_subscription_id TEXT NULL,
  external_reference TEXT NOT NULL UNIQUE,
  payment_method_type TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (payment_method_type IN ('credit_card', 'pix_automatic_future', 'unconfigured')),
  payment_method_label TEXT NULL,
  payment_method_brand TEXT NULL,
  payment_method_last4 TEXT NULL
    CHECK (payment_method_last4 IS NULL OR payment_method_last4 ~ '^[0-9]{4}$'),
  authorization_token_hash TEXT NULL,
  authorization_expires_at TIMESTAMPTZ NULL,
  authorization_url TEXT NULL,
  authorized_at TIMESTAMPTZ NULL,
  contract_accepted_at TIMESTAMPTZ NULL,
  contract_accepted_by_name TEXT NULL,
  activation_confirmed_at TIMESTAMPTZ NULL,
  activation_confirmed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_start_date DATE NOT NULL,
  activated_at TIMESTAMPTZ NULL,
  next_billing_date DATE NULL,
  current_period_start DATE NULL,
  current_period_end DATE NULL,
  grace_period_days INTEGER NOT NULL DEFAULT 7
    CHECK (grace_period_days BETWEEN 0 AND 60),
  delinquent_since TIMESTAMPTZ NULL,
  consecutive_failed_charges INTEGER NOT NULL DEFAULT 0
    CHECK (consecutive_failed_charges >= 0),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancellation_requested_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_reason TEXT NULL,
  admin_notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Impede mais de uma assinatura aberta simultaneamente para a mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscriptions_one_open_per_tenant
  ON public.billing_subscriptions (tenant_id)
  WHERE status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscriptions_provider_ext_id
  ON public.billing_subscriptions (provider, external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status_next_billing
  ON public.billing_subscriptions (status, next_billing_date);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant_created
  ON public.billing_subscriptions (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created',
      'authorization_requested',
      'authorized',
      'activation_confirmed',
      'activated',
      'payment_method_updated',
      'contract_amount_updated',
      'status_changed',
      'delinquency_flagged',
      'regularized',
      'cancellation_scheduled',
      'cancelled',
      'admin_exception_recorded'
    )),
  previous_status TEXT NULL,
  new_status TEXT NULL,
  previous_amount_cents INTEGER NULL,
  new_amount_cents INTEGER NULL,
  actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_sub_history_sub_created
  ON public.billing_subscription_history (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_sub_history_tenant
  ON public.billing_subscription_history (tenant_id, created_at DESC);

-- ==============================================================================
-- 3. FATURAS / COBRANÇAS RECORRENTES, TENTATIVAS E WEBHOOKS EXCLUSIVOS DO BILLING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  billing_cycle_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment = 'sandbox'),
  provider TEXT NOT NULL DEFAULT 'mercado_pago'
    CHECK (provider IN ('mercado_pago', 'sandbox_simulator')),
  external_payment_id TEXT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'scheduled',
      'pending',
      'processing',
      'paid',
      'failed',
      'overdue',
      'refunded',
      'void'
    )),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  failure_code TEXT NULL,
  failure_reason TEXT NULL,
  payment_method_type TEXT NULL
    CHECK (payment_method_type IS NULL OR payment_method_type IN ('credit_card', 'pix_automatic_future', 'unconfigured')),
  payment_method_label TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at TIMESTAMPTZ NULL,
  last_reconciled_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_invoices_sub_cycle UNIQUE (subscription_id, billing_cycle_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoices_provider_ext_payment
  ON public.billing_invoices (provider, external_payment_id)
  WHERE external_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_due
  ON public.billing_invoices (tenant_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_status_due
  ON public.billing_invoices (status, due_date DESC);

DROP TRIGGER IF EXISTS trg_billing_invoices_updated_at ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_invoice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'sandbox_simulator')),
  external_attempt_id TEXT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('initiated', 'processing', 'approved', 'rejected', 'error')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  failure_code TEXT NULL,
  failure_reason TEXT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_attempts_invoice
  ON public.billing_invoice_attempts (invoice_id, attempt_number DESC);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'sandbox_simulator')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment = 'sandbox'),
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_resource_id TEXT NULL,
  subscription_id UUID NULL REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID NULL REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL
    CHECK (processing_status IN ('processed', 'duplicate', 'rejected_signature', 'ignored', 'error')),
  error_message TEXT NULL,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_billing_webhook_provider_event UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhooks_sub_received
  ON public.billing_webhook_events (subscription_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_webhooks_status
  ON public.billing_webhook_events (processing_status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID NULL REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID NULL REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'authorization_requested',
      'upcoming_charge',
      'payment_confirmed',
      'payment_failed',
      'delinquency_reminder',
      'due_date_notice',
      'cancellation_confirmed'
    )),
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email_prepared', 'whatsapp_prepared')),
  status TEXT NOT NULL DEFAULT 'queued_disabled'
    CHECK (status IN ('queued_disabled', 'logged_sandbox', 'sent', 'cancelled')),
  recipient_masked TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_notifications_tenant_created
  ON public.billing_notifications_queue (tenant_id, created_at DESC);

-- ==============================================================================
-- 4. FLUXO C — CONTRATOS DE IMPLANTAÇÃO 50/50 E RECEBIMENTOS MANUAIS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.implementation_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  contract_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  scope_summary TEXT NOT NULL CHECK (char_length(btrim(scope_summary)) >= 5),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  entry_percent INTEGER NOT NULL DEFAULT 50 CHECK (entry_percent BETWEEN 0 AND 100),
  balance_percent INTEGER NOT NULL DEFAULT 50 CHECK (balance_percent BETWEEN 0 AND 100),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status TEXT NOT NULL DEFAULT 'awaiting_entry'
    CHECK (status IN (
      'draft',
      'awaiting_entry',
      'in_development',
      'delivered_awaiting_balance',
      'completed',
      'cancelled'
    )),
  custom_terms_note TEXT NULL,
  accepted_at TIMESTAMPTZ NULL,
  accepted_by_name TEXT NULL,
  project_started_at TIMESTAMPTZ NULL,
  delivery_confirmed_at TIMESTAMPTZ NULL,
  delivery_confirmed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_reason TEXT NULL,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_implementation_percent_sum CHECK (entry_percent + balance_percent = 100)
);

CREATE INDEX IF NOT EXISTS idx_impl_contracts_tenant_created
  ON public.implementation_contracts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impl_contracts_status
  ON public.implementation_contracts (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_implementation_contracts_updated_at ON public.implementation_contracts;
CREATE TRIGGER trg_implementation_contracts_updated_at
  BEFORE UPDATE ON public.implementation_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE TABLE IF NOT EXISTS public.implementation_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.implementation_contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installment_kind TEXT NOT NULL
    CHECK (installment_kind IN ('entry', 'balance', 'custom_milestone')),
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 120),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  due_date DATE NULL,
  milestone_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'receipt_attached', 'confirmed', 'cancelled')),
  reported_payment_method TEXT NULL
    CHECK (reported_payment_method IS NULL OR reported_payment_method IN (
      'pix_manual', 'bank_transfer', 'cash', 'boleto_manual', 'card_machine', 'other'
    )),
  receipt_storage_path TEXT NULL,
  receipt_file_name TEXT NULL,
  receipt_mime_type TEXT NULL,
  receipt_size_bytes INTEGER NULL CHECK (receipt_size_bytes IS NULL OR receipt_size_bytes > 0),
  receipt_sha256 TEXT NULL,
  receipt_attached_at TIMESTAMPTZ NULL,
  receipt_attached_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ NULL,
  confirmed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmation_note TEXT NULL,
  idempotency_confirm_key TEXT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_impl_installments_contract_seq UNIQUE (contract_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_impl_installments_contract
  ON public.implementation_installments (contract_id, sequence_number ASC);

CREATE INDEX IF NOT EXISTS idx_impl_installments_tenant_status
  ON public.implementation_installments (tenant_id, status);

DROP TRIGGER IF EXISTS trg_implementation_installments_updated_at ON public.implementation_installments;
CREATE TRIGGER trg_implementation_installments_updated_at
  BEFORE UPDATE ON public.implementation_installments
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE TABLE IF NOT EXISTS public.implementation_contract_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.implementation_contracts(id) ON DELETE CASCADE,
  installment_id UUID NULL REFERENCES public.implementation_installments(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'contract_created',
      'contract_updated',
      'project_started',
      'receipt_attached',
      'installment_confirmed',
      'delivery_confirmed',
      'contract_completed',
      'contract_cancelled',
      'admin_correction'
    )),
  actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impl_history_contract_created
  ON public.implementation_contract_history (contract_id, created_at DESC);

-- ==============================================================================
-- 5. BUCKET PRIVADO DE COMPROVANTES DE IMPLANTAÇÃO (SEPARADO DO retail-media)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'billing-receipts',
  'billing-receipts',
  false,
  5242880,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS billing_receipts_platform_admin_only ON storage.objects;
CREATE POLICY billing_receipts_platform_admin_only ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'billing-receipts'
    AND public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'billing-receipts'
    AND public.is_platform_admin(auth.uid())
  );

-- ==============================================================================
-- 6. RLS + FORCE ROW LEVEL SECURITY EM TODAS AS 11 TABELAS
-- ==============================================================================
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plan_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscription_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_invoice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_notifications_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notifications_queue FORCE ROW LEVEL SECURITY;

ALTER TABLE public.implementation_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementation_contracts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.implementation_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementation_installments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.implementation_contract_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementation_contract_history FORCE ROW LEVEL SECURITY;

-- Planos: Platform Admin acesso total; Owner lê apenas o plano da própria assinatura
DROP POLICY IF EXISTS billing_plans_platform_admin_all ON public.billing_plans;
CREATE POLICY billing_plans_platform_admin_all ON public.billing_plans
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_plans_owner_assigned_select ON public.billing_plans;
CREATE POLICY billing_plans_owner_assigned_select ON public.billing_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.billing_subscriptions bs
       WHERE bs.plan_id = billing_plans.id
         AND public.is_tenant_active(bs.tenant_id)
         AND public.has_tenant_role(bs.tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
    )
  );

DROP POLICY IF EXISTS billing_plan_history_platform_admin_all ON public.billing_plan_history;
CREATE POLICY billing_plan_history_platform_admin_all ON public.billing_plan_history
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Assinaturas: Platform Admin total; Owner APENAS SELECT da própria empresa; Manager/Staff ZERO acesso
DROP POLICY IF EXISTS billing_subscriptions_platform_admin_all ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_platform_admin_all ON public.billing_subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_subscriptions_owner_select ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_owner_select ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

DROP POLICY IF EXISTS billing_sub_history_platform_admin_all ON public.billing_subscription_history;
CREATE POLICY billing_sub_history_platform_admin_all ON public.billing_subscription_history
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_sub_history_owner_select ON public.billing_subscription_history;
CREATE POLICY billing_sub_history_owner_select ON public.billing_subscription_history
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

-- Faturas e Tentativas: Platform Admin total; Owner APENAS SELECT da própria empresa
DROP POLICY IF EXISTS billing_invoices_platform_admin_all ON public.billing_invoices;
CREATE POLICY billing_invoices_platform_admin_all ON public.billing_invoices
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_invoices_owner_select ON public.billing_invoices;
CREATE POLICY billing_invoices_owner_select ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

DROP POLICY IF EXISTS billing_attempts_platform_admin_all ON public.billing_invoice_attempts;
CREATE POLICY billing_attempts_platform_admin_all ON public.billing_invoice_attempts
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_attempts_owner_select ON public.billing_invoice_attempts;
CREATE POLICY billing_attempts_owner_select ON public.billing_invoice_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

-- Webhooks: Exclusivo Platform Admin (escrita somente service_role)
DROP POLICY IF EXISTS billing_webhooks_platform_admin_select ON public.billing_webhook_events;
CREATE POLICY billing_webhooks_platform_admin_select ON public.billing_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Notificações: Platform Admin total; Owner apenas leitura da própria empresa
DROP POLICY IF EXISTS billing_notifications_platform_admin_all ON public.billing_notifications_queue;
CREATE POLICY billing_notifications_platform_admin_all ON public.billing_notifications_queue
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS billing_notifications_owner_select ON public.billing_notifications_queue;
CREATE POLICY billing_notifications_owner_select ON public.billing_notifications_queue
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

-- Contratos de Implantação 50/50: Platform Admin total; Owner APENAS SELECT da própria empresa; Manager/Staff ZERO acesso
DROP POLICY IF EXISTS impl_contracts_platform_admin_all ON public.implementation_contracts;
CREATE POLICY impl_contracts_platform_admin_all ON public.implementation_contracts
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS impl_contracts_owner_select ON public.implementation_contracts;
CREATE POLICY impl_contracts_owner_select ON public.implementation_contracts
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

DROP POLICY IF EXISTS impl_installments_platform_admin_all ON public.implementation_installments;
CREATE POLICY impl_installments_platform_admin_all ON public.implementation_installments
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS impl_installments_owner_select ON public.implementation_installments;
CREATE POLICY impl_installments_owner_select ON public.implementation_installments
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

DROP POLICY IF EXISTS impl_history_platform_admin_all ON public.implementation_contract_history;
CREATE POLICY impl_history_platform_admin_all ON public.implementation_contract_history
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS impl_history_owner_select ON public.implementation_contract_history;
CREATE POLICY impl_history_owner_select ON public.implementation_contract_history
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_active(tenant_id)
    AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner']::public.membership_role[])
  );

-- ==============================================================================
-- 7. RPCs TRANSACIONAIS ATÔMICAS E IDEMPOTENTES (EXCLUSIVAS DE service_role)
-- ==============================================================================

-- 7.1 Reconciliação atômica e idempotente de cobrança recorrente / webhook Billing SaaS
--     - Nunca suspende tenants.status automaticamente (§9)
--     - Nunca duplica receita ou contabiliza tentativa repetida duas vezes (§5.3, §11)
CREATE OR REPLACE FUNCTION public.reconcile_billing_invoice_tx(
  p_subscription_id UUID,
  p_provider TEXT,
  p_external_event_id TEXT,
  p_event_type TEXT,
  p_signature_verified BOOLEAN,
  p_billing_cycle_key TEXT,
  p_external_payment_id TEXT,
  p_authoritative_status TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT,
  p_due_date DATE,
  p_payment_method_type TEXT DEFAULT 'credit_card',
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
  v_sub public.billing_subscriptions%ROWTYPE;
  v_inv public.billing_invoices%ROWTYPE;
  v_existing_evt_id UUID;
  v_prev_sub_status TEXT;
  v_new_sub_status TEXT;
  v_next_billing DATE;
  v_invoice_number TEXT;
  v_attempt_num INTEGER;
  v_notif_type TEXT;
BEGIN
  IF p_signature_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'BILLING_WEBHOOK_SIGNATURE_REQUIRED';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'BILLING_INVALID_AMOUNT';
  END IF;

  IF p_currency <> 'BRL' THEN
    RAISE EXCEPTION 'BILLING_INVALID_CURRENCY';
  END IF;

  -- 1. Idempotência de evento de webhook (mesmo provider + external_event_id nunca processa 2x)
  SELECT id INTO v_existing_evt_id
    FROM public.billing_webhook_events
   WHERE provider = p_provider
     AND external_event_id = p_external_event_id
   LIMIT 1;

  IF v_existing_evt_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'duplicate',
      'eventId', v_existing_evt_id,
      'subscriptionId', p_subscription_id
    );
  END IF;

  -- 2. Lock pessimista na assinatura alvo
  SELECT * INTO v_sub
    FROM public.billing_subscriptions
   WHERE id = p_subscription_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BILLING_SUBSCRIPTION_NOT_FOUND';
  END IF;

  v_prev_sub_status := v_sub.status;

  -- 3. Localizar ou criar fatura única para o ciclo (subscription_id + billing_cycle_key)
  SELECT * INTO v_inv
    FROM public.billing_invoices
   WHERE subscription_id = v_sub.id
     AND billing_cycle_key = p_billing_cycle_key
   FOR UPDATE;

  IF NOT FOUND THEN
    v_invoice_number := 'FAT-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    INSERT INTO public.billing_invoices (
      subscription_id,
      tenant_id,
      invoice_number,
      billing_cycle_key,
      environment,
      provider,
      external_payment_id,
      idempotency_key,
      amount_cents,
      currency,
      status,
      due_date,
      payment_method_type,
      payment_method_label,
      attempt_count,
      last_reconciled_at,
      metadata
    )
    VALUES (
      v_sub.id,
      v_sub.tenant_id,
      v_invoice_number,
      p_billing_cycle_key,
      'sandbox',
      p_provider,
      NULLIF(btrim(COALESCE(p_external_payment_id, '')), ''),
      p_provider || ':' || v_sub.id::text || ':' || p_billing_cycle_key,
      p_amount_cents,
      p_currency,
      CASE
        WHEN p_authoritative_status IN ('paid', 'pending', 'processing', 'failed', 'overdue', 'refunded', 'void')
          THEN p_authoritative_status
        ELSE 'pending'
      END,
      COALESCE(p_due_date, CURRENT_DATE),
      COALESCE(p_payment_method_type, v_sub.payment_method_type),
      COALESCE(p_payment_method_label, v_sub.payment_method_label),
      1,
      now(),
      COALESCE(p_payload_summary, '{}'::jsonb)
    )
    RETURNING * INTO v_inv;
    v_attempt_num := 1;
  ELSE
    -- Proteção contra downgrade indevido de fatura já paga (exceto estorno explícito)
    IF v_inv.status = 'paid' AND p_authoritative_status IN ('pending', 'processing', 'failed', 'overdue') THEN
      INSERT INTO public.billing_webhook_events (
        provider, environment, external_event_id, event_type, resource_type,
        external_resource_id, subscription_id, invoice_id, tenant_id,
        signature_verified, processing_status, payload_summary, processed_at
      )
      VALUES (
        p_provider, 'sandbox', p_external_event_id, p_event_type, 'authorized_payment',
        p_external_payment_id, v_sub.id, v_inv.id, v_sub.tenant_id,
        true, 'ignored', COALESCE(p_payload_summary, '{}'::jsonb), now()
      );

      RETURN jsonb_build_object(
        'outcome', 'ignored_out_of_order',
        'invoiceId', v_inv.id,
        'invoiceStatus', v_inv.status,
        'subscriptionStatus', v_sub.status
      );
    END IF;

    v_attempt_num := v_inv.attempt_count + 1;

    UPDATE public.billing_invoices
       SET external_payment_id = COALESCE(NULLIF(btrim(COALESCE(p_external_payment_id, '')), ''), external_payment_id),
           status = CASE
             WHEN p_authoritative_status IN ('paid', 'pending', 'processing', 'failed', 'overdue', 'refunded', 'void')
               THEN p_authoritative_status
             ELSE status
           END,
           paid_at = CASE WHEN p_authoritative_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
           failed_at = CASE WHEN p_authoritative_status IN ('failed', 'overdue') THEN now() ELSE failed_at END,
           refunded_at = CASE WHEN p_authoritative_status = 'refunded' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
           refunded_amount_cents = CASE WHEN p_authoritative_status = 'refunded' THEN amount_cents ELSE refunded_amount_cents END,
           failure_code = CASE WHEN p_authoritative_status IN ('failed', 'overdue') THEN p_failure_code ELSE NULL END,
           failure_reason = CASE WHEN p_authoritative_status IN ('failed', 'overdue') THEN p_failure_reason ELSE NULL END,
           payment_method_type = COALESCE(p_payment_method_type, payment_method_type),
           payment_method_label = COALESCE(p_payment_method_label, payment_method_label),
           attempt_count = v_attempt_num,
           last_reconciled_at = now()
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;
  END IF;

  -- Garantir paid_at preenchido quando recém-criada já paga
  IF v_inv.status = 'paid' AND v_inv.paid_at IS NULL THEN
    UPDATE public.billing_invoices
       SET paid_at = now()
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;
  ELSIF v_inv.status IN ('failed', 'overdue') AND v_inv.failed_at IS NULL THEN
    UPDATE public.billing_invoices
       SET failed_at = now(),
           failure_code = p_failure_code,
           failure_reason = p_failure_reason
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;
  END IF;

  -- 4. Registrar tentativa de cobrança
  INSERT INTO public.billing_invoice_attempts (
    invoice_id,
    subscription_id,
    tenant_id,
    attempt_number,
    provider,
    external_attempt_id,
    status,
    amount_cents,
    failure_code,
    failure_reason,
    idempotency_key,
    metadata
  )
  VALUES (
    v_inv.id,
    v_sub.id,
    v_sub.tenant_id,
    v_attempt_num,
    p_provider,
    p_external_payment_id,
    CASE
      WHEN p_authoritative_status = 'paid' THEN 'approved'
      WHEN p_authoritative_status IN ('failed', 'overdue') THEN 'rejected'
      WHEN p_authoritative_status = 'processing' THEN 'processing'
      ELSE 'initiated'
    END,
    p_amount_cents,
    p_failure_code,
    p_failure_reason,
    p_provider || ':attempt:' || p_external_event_id,
    COALESCE(p_payload_summary, '{}'::jsonb)
  );

  -- 5. Atualizar máquina de estados da assinatura (NUNCA suspender tenant/loja!)
  v_new_sub_status := v_sub.status;
  v_next_billing := v_sub.next_billing_date;
  v_notif_type := NULL;

  IF p_authoritative_status = 'paid' THEN
    v_new_sub_status := CASE
      WHEN v_sub.cancel_at_period_end THEN 'cancel_scheduled'
      ELSE 'active'
    END;
    v_next_billing := (
      COALESCE(v_inv.due_date, CURRENT_DATE) +
      CASE v_sub.billing_cycle
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'semiannual' THEN INTERVAL '6 months'
        WHEN 'annual' THEN INTERVAL '1 year'
        ELSE INTERVAL '1 month'
      END
    )::date;

    UPDATE public.billing_subscriptions
       SET status = v_new_sub_status,
           activated_at = COALESCE(activated_at, now()),
           current_period_start = COALESCE(v_inv.due_date, CURRENT_DATE),
           current_period_end = v_next_billing,
           next_billing_date = CASE WHEN v_sub.cancel_at_period_end THEN NULL ELSE v_next_billing END,
           delinquent_since = NULL,
           consecutive_failed_charges = 0
     WHERE id = v_sub.id;

    v_notif_type := 'payment_confirmed';

  ELSIF p_authoritative_status IN ('failed', 'overdue') THEN
    -- Primeira falha não cancela nem suspende a loja; sinaliza atraso administrativo
    v_new_sub_status := CASE
      WHEN v_sub.status = 'cancelled' THEN 'cancelled'
      WHEN p_authoritative_status = 'overdue' OR v_sub.consecutive_failed_charges >= 1 THEN 'past_due'
      ELSE 'pending_payment'
    END;

    UPDATE public.billing_subscriptions
       SET status = v_new_sub_status,
           delinquent_since = COALESCE(delinquent_since, now()),
           consecutive_failed_charges = consecutive_failed_charges + 1
     WHERE id = v_sub.id;

    v_notif_type := CASE
      WHEN v_new_sub_status = 'past_due' THEN 'delinquency_reminder'
      ELSE 'payment_failed'
    END;

  ELSIF p_authoritative_status IN ('pending', 'processing') THEN
    IF v_sub.status NOT IN ('active', 'past_due', 'cancel_scheduled', 'cancelled') THEN
      v_new_sub_status := 'pending_payment';
      UPDATE public.billing_subscriptions
         SET status = v_new_sub_status
       WHERE id = v_sub.id;
    END IF;
  END IF;

  -- 6. Histórico da assinatura quando houver mudança relevante
  IF v_new_sub_status <> v_prev_sub_status THEN
    INSERT INTO public.billing_subscription_history (
      subscription_id,
      tenant_id,
      event_type,
      previous_status,
      new_status,
      reason,
      metadata
    )
    VALUES (
      v_sub.id,
      v_sub.tenant_id,
      CASE
        WHEN v_prev_sub_status IN ('past_due', 'pending_payment', 'in_regularization') AND v_new_sub_status = 'active'
          THEN 'regularized'
        WHEN v_new_sub_status = 'past_due' THEN 'delinquency_flagged'
        WHEN v_new_sub_status = 'active' AND v_prev_sub_status IN ('awaiting_activation', 'awaiting_authorization')
          THEN 'activated'
        ELSE 'status_changed'
      END,
      v_prev_sub_status,
      v_new_sub_status,
      COALESCE(p_failure_reason, 'Reconciliação autoritativa de cobrança ' || v_inv.invoice_number),
      jsonb_build_object(
        'invoiceId', v_inv.id,
        'invoiceNumber', v_inv.invoice_number,
        'authoritativeStatus', p_authoritative_status
      )
    );
  END IF;

  -- 7. Registrar evento de webhook processado (idempotente)
  INSERT INTO public.billing_webhook_events (
    provider,
    environment,
    external_event_id,
    event_type,
    resource_type,
    external_resource_id,
    subscription_id,
    invoice_id,
    tenant_id,
    signature_verified,
    processing_status,
    payload_summary,
    processed_at
  )
  VALUES (
    p_provider,
    'sandbox',
    p_external_event_id,
    p_event_type,
    'authorized_payment',
    p_external_payment_id,
    v_sub.id,
    v_inv.id,
    v_sub.tenant_id,
    true,
    'processed',
    COALESCE(p_payload_summary, '{}'::jsonb),
    now()
  );

  -- 8. Preparar notificação auditável (sem disparo externo automático em staging)
  IF v_notif_type IS NOT NULL THEN
    INSERT INTO public.billing_notifications_queue (
      tenant_id,
      subscription_id,
      invoice_id,
      notification_type,
      channel,
      status,
      payload
    )
    VALUES (
      v_sub.tenant_id,
      v_sub.id,
      v_inv.id,
      v_notif_type,
      'in_app',
      'logged_sandbox',
      jsonb_build_object(
        'invoiceNumber', v_inv.invoice_number,
        'amountCents', v_inv.amount_cents,
        'status', v_inv.status,
        'subscriptionStatus', v_new_sub_status
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'processed',
    'invoiceId', v_inv.id,
    'invoiceNumber', v_inv.invoice_number,
    'invoiceStatus', v_inv.status,
    'subscriptionId', v_sub.id,
    'previousSubscriptionStatus', v_prev_sub_status,
    'subscriptionStatus', v_new_sub_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_billing_invoice_tx(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_billing_invoice_tx(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

-- 7.2 Confirmação atômica e idempotente de parcela manual de implantação (50/50)
--     - Garante que uma parcela jamais seja confirmada/contabilizada duas vezes (§10)
CREATE OR REPLACE FUNCTION public.confirm_implementation_installment_tx(
  p_installment_id UUID,
  p_actor_user_id UUID,
  p_reported_payment_method TEXT,
  p_confirmation_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inst public.implementation_installments%ROWTYPE;
  v_contract public.implementation_contracts%ROWTYPE;
  v_pending_count INTEGER;
  v_new_contract_status TEXT;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_platform_admin(p_actor_user_id) THEN
    RAISE EXCEPTION 'BILLING_FORBIDDEN_PLATFORM_ADMIN_ONLY';
  END IF;

  SELECT * INTO v_inst
    FROM public.implementation_installments
   WHERE id = p_installment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPLEMENTATION_INSTALLMENT_NOT_FOUND';
  END IF;

  -- Idempotência: se já confirmada, retorna sem recontabilizar
  IF v_inst.status = 'confirmed' THEN
    IF p_idempotency_key IS NOT NULL AND v_inst.idempotency_confirm_key = p_idempotency_key THEN
      RETURN jsonb_build_object(
        'outcome', 'already_confirmed',
        'installmentId', v_inst.id,
        'contractId', v_inst.contract_id
      );
    END IF;
    RAISE EXCEPTION 'IMPLEMENTATION_INSTALLMENT_ALREADY_CONFIRMED';
  END IF;

  IF v_inst.status = 'cancelled' THEN
    RAISE EXCEPTION 'IMPLEMENTATION_INSTALLMENT_CANCELLED';
  END IF;

  SELECT * INTO v_contract
    FROM public.implementation_contracts
   WHERE id = v_inst.contract_id
   FOR UPDATE;

  IF v_contract.status = 'cancelled' THEN
    RAISE EXCEPTION 'IMPLEMENTATION_CONTRACT_CANCELLED';
  END IF;

  UPDATE public.implementation_installments
     SET status = 'confirmed',
         reported_payment_method = COALESCE(p_reported_payment_method, reported_payment_method, 'pix_manual'),
         confirmed_at = now(),
         confirmed_by = p_actor_user_id,
         confirmation_note = p_confirmation_note,
         idempotency_confirm_key = COALESCE(p_idempotency_key, 'confirm:' || v_inst.id::text)
   WHERE id = v_inst.id
   RETURNING * INTO v_inst;

  SELECT count(*) INTO v_pending_count
    FROM public.implementation_installments
   WHERE contract_id = v_contract.id
     AND status <> 'confirmed'
     AND status <> 'cancelled';

  v_new_contract_status := v_contract.status;
  IF v_inst.installment_kind = 'entry' AND v_contract.status IN ('draft', 'awaiting_entry') THEN
    v_new_contract_status := 'in_development';
    UPDATE public.implementation_contracts
       SET status = v_new_contract_status,
           project_started_at = COALESCE(project_started_at, now())
     WHERE id = v_contract.id;
  ELSIF v_pending_count = 0 AND v_contract.delivery_confirmed_at IS NOT NULL THEN
    v_new_contract_status := 'completed';
    UPDATE public.implementation_contracts
       SET status = v_new_contract_status,
           completed_at = COALESCE(completed_at, now())
     WHERE id = v_contract.id;
  END IF;

  INSERT INTO public.implementation_contract_history (
    contract_id,
    installment_id,
    tenant_id,
    action,
    actor_user_id,
    note,
    metadata
  )
  VALUES (
    v_contract.id,
    v_inst.id,
    v_contract.tenant_id,
    'installment_confirmed',
    p_actor_user_id,
    COALESCE(p_confirmation_note, 'Recebimento manual confirmado para ' || v_inst.label),
    jsonb_build_object(
      'installmentKind', v_inst.installment_kind,
      'amountCents', v_inst.amount_cents,
      'reportedPaymentMethod', v_inst.reported_payment_method,
      'hasReceipt', v_inst.receipt_storage_path IS NOT NULL,
      'contractStatus', v_new_contract_status
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'confirmed',
    'installmentId', v_inst.id,
    'contractId', v_contract.id,
    'contractStatus', v_new_contract_status,
    'confirmedAt', v_inst.confirmed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_implementation_installment_tx(
  UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_implementation_installment_tx(
  UUID, UUID, TEXT, TEXT, TEXT
) TO service_role;
