-- =============================================================================
-- Migration: 20261120000001_create_marketing_leads.sql
-- Escopo: EXCLUSIVO para o projeto Supabase de Marketing da DevEssent Landing.
-- ATENÇÃO: NÃO aplicar no banco principal da DevEssent Platform sem separação
--          explícita e aprovação. Não altera nenhuma tabela da Platform.
--
-- Plano de Rollback:
--   DROP TABLE IF EXISTS public.marketing_leads CASCADE;
--   DROP TYPE IF EXISTS public.marketing_lead_status;
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'marketing_lead_status'
  ) THEN
    CREATE TYPE public.marketing_lead_status AS ENUM (
      'new',
      'contacted',
      'qualified',
      'archived',
      'spam'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  company TEXT NOT NULL DEFAULT '' CHECK (char_length(company) <= 120),
  email TEXT NOT NULL CHECK (char_length(trim(email)) BETWEEN 5 AND 160),
  whatsapp TEXT NOT NULL CHECK (char_length(trim(whatsapp)) BETWEEN 8 AND 40),
  service_interest TEXT NOT NULL CHECK (char_length(trim(service_interest)) BETWEEN 2 AND 140),
  message TEXT NOT NULL CHECK (char_length(trim(message)) BETWEEN 10 AND 2000),
  source TEXT NOT NULL DEFAULT 'devessent-landing-contact' CHECK (char_length(source) <= 80),
  status public.marketing_lead_status NOT NULL DEFAULT 'new',
  privacy_consent BOOLEAN NOT NULL DEFAULT FALSE CHECK (privacy_consent = TRUE),
  consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_hash TEXT NOT NULL,
  client_ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_leads IS
  'Leads comerciais recebidos exclusivamente pela DevEssent Landing Page via Edge Function marketing-contact. Zero leitura pública.';

CREATE INDEX IF NOT EXISTS idx_marketing_leads_created_at
  ON public.marketing_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_status
  ON public.marketing_leads (status);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_dedupe_recent
  ON public.marketing_leads (dedupe_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_ip_recent
  ON public.marketing_leads (client_ip_hash, created_at DESC);

-- Segurança Restritiva (Deny-by-Default):
-- Nenhum papel público (anon/authenticated) possui permissão de SELECT, INSERT, UPDATE ou DELETE.
-- Apenas o papel privilegiado service_role (usado exclusivamente no backend da Edge Function)
-- pode inserir registros após validação server-side, Turnstile e rate limiting.
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.marketing_leads FROM anon;
REVOKE ALL ON TABLE public.marketing_leads FROM authenticated;
