# Integração Supabase de Marketing — DevEssent Landing Page

Documentação da arquitetura de banco, RLS, Cloudflare Turnstile e Edge Function `marketing-contact` isolada para a landing page (`apps/landing/supabase/`).

## 1. Princípio de Isolamento

A infraestrutura de marketing da landing page é **completamente separada** da DevEssent Platform:

- **Não compartilha** tabelas de usuários, `profiles`, `tenants`, `tenant_memberships`, Retail, pedidos, estoque, pagamentos ou sessões da Platform.
- **Não mistura histórico de migrations:** as migrations da landing residem exclusivamente em `apps/landing/supabase/migrations/`, nunca na raiz `supabase/migrations/`.
- **Sem Supabase Auth na landing:** visitantes anônimos não precisam de login; a segurança da rota pública é garantida por validação server-side, CORS restritivo, Honeypot, Cloudflare Turnstile Siteverify, rate limiting e deduplicação.

## 2. Decisão sobre Projeto Supabase e Plano Free

Na auditoria de conta realizada via Supabase CLI (`supabase projects list`):

- Organização `hugoarimateia-DEV`: `EJCMONTESIAO` (**ACTIVE_HEALTHY** — intocável), além de projetos pausados.
- Organização `DevEssent` (`wctzfhlxtmmbvlalmuxe`): `dev-essent.staging` (`auebnppzxcvtaaqqlbts`, **ACTIVE_HEALTHY** — staging da Platform).

O plano gratuito do Supabase limita cada conta a **2 projetos ativos simultâneos**. Como os 2 slots gratuitos já estão ocupados (`EJCMONTESIAO` + `dev-essent.staging`), provisionar um 3º projeto ativo na mesma conta exigiria plano pago (Pro), o que está proibido.

### Estratégia adotada (custo zero e segurança máxima)

1. **Publicação inicial segura:** o formulário `/contato` opera em modo transparente **`channel_assisted`** (validação completa + briefing estruturado + encaminhamento direto via WhatsApp, e-mail e cópia), sem armazenar leads comerciais reais no banco de staging da Platform (`auebnppzxcvtaaqqlbts`).
2. **Infraestrutura pronta para ativação imediata:** migration `marketing_leads` e Edge Function `marketing-contact` já estão implementadas, versionadas e cobertas por testes unitários automatizados em `apps/landing/`.
3. **Ativação futura sem custos:** criar um projeto Supabase Free dedicado para marketing (em uma conta Supabase institucional exclusiva da DevEssent ou após liberação de slot gratuito) e aplicar a migration + Edge Function descritas abaixo.

## 3. Estrutura de Dados e RLS (`marketing_leads`)

Arquivo: `apps/landing/supabase/migrations/20261120000001_create_marketing_leads.sql`

- Tabela `public.marketing_leads` com checks de comprimento para todos os campos, consentimento LGPD obrigatório (`privacy_consent = TRUE`), `source`, `status` (`new | contacted | qualified | archived | spam`), `dedupe_hash` e `client_ip_hash` (SHA-256).
- **RLS habilitado e forçado (`ENABLE` + `FORCE ROW LEVEL SECURITY`)** com `REVOKE ALL` para `PUBLIC`, `anon` e `authenticated`.
- **Zero leitura pública (`SELECT` bloqueado)** e **zero escrita direta pelo navegador**.
- **Rollback documentado:**
  ```sql
  DROP TABLE IF EXISTS public.marketing_leads CASCADE;
  DROP TYPE IF EXISTS public.marketing_lead_status;
  ```

## 4. Edge Function `marketing-contact`

Arquivos:
- `apps/landing/supabase/functions/marketing-contact/handler.ts` (lógica pura e testável)
- `apps/landing/supabase/functions/marketing-contact/index.ts` (entrypoint Deno)

Controles implementados:

1. **HTTP & Payload:** aceita somente `POST` (e `OPTIONS` para preflight), exige `application/json` e bloqueia payloads acima de **16 KB** (`413`).
2. **CORS explícito:** permite somente origins listados em `MARKETING_ALLOWED_ORIGINS` (rejeita origins não autorizadas com `403`, sem usar `*`).
3. **Validação e sanitização server-side:** valida nome, e-mail, WhatsApp, serviço, mensagem (10–2000 chars) e consentimento LGPD; remove caracteres de controle e `<`/`>`.
4. **Anti-spam (Honeypot + Cloudflare Turnstile):**
   - Bloqueia preenchimento do campo oculto `website_url`.
   - Valida o token na API oficial `https://challenges.cloudflare.com/turnstile/v0/siteverify`, conferindo `success`, `hostname` (`TURNSTILE_ALLOWED_HOSTNAMES`) e `action` (`marketing_contact`).
5. **Rate limiting e deduplicação:** limita a 5 envios por IP (hash SHA-256) a cada 5 minutos (`429`) e bloqueia reenvios idênticos em 10 minutos (`409`).
6. **Privacidade nos logs:** registra apenas eventos técnicos e `leadId` — nunca e-mail, telefone, IP bruto ou segredos.

## 5. Segredos da Edge Function (Nunca no Frontend nem no Git)

Ao ativar o projeto Supabase dedicado da landing:

```bash
cd apps/landing

# 1. Vincular ao projeto Supabase DEDICADO de marketing (confirmar project-ref!)
supabase link --project-ref <MARKETING_PROJECT_REF>

# 2. Aplicar migration apenas após conferir o projeto alvo e o rollback
supabase db push

# 3. Configurar segredos exclusivamente no ambiente da Edge Function
supabase secrets set \
  MARKETING_ALLOWED_ORIGINS="https://devessent-landing.pages.dev" \
  TURNSTILE_ALLOWED_HOSTNAMES="devessent-landing.pages.dev" \
  TURNSTILE_EXPECTED_ACTION="marketing_contact" \
  TURNSTILE_REQUIRED="true" \
  TURNSTILE_SECRET_KEY="<CLOUDFLARE_TURNSTILE_SECRET_KEY>"

# 4. Publicar a função explicitamente (verify_jwt=false configurado em config.toml)
supabase functions deploy marketing-contact --no-verify-jwt
```

Em seguida, configurar no Cloudflare Pages:
- `NEXT_PUBLIC_CONTACT_ENDPOINT=https://<MARKETING_PROJECT_REF>.supabase.co/functions/v1/marketing-contact`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY_DO_PROJETO_DE_MARKETING>`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<CLOUDFLARE_TURNSTILE_SITE_KEY>`

## 6. Como Testar o Formulário e a Edge Function

- **Testes automatizados offline (CI e local):**
  ```bash
  cd apps/landing
  pnpm test
  ```
  Cobre CORS permitido/negado, métodos inválidos, payload > 16 KB, honeypot, Turnstile ausente/inválido/expirado/reutilizado/hostname divergente, rate-limit (`429`), duplicidade (`409`), inserção sanitizada (`201`) e ausência de PII nos logs.
- **Teste manual pós-ativação (usar apenas dados fictícios):**
  - Testar submissão válida com widget Turnstile no Preview/Produção.
  - Confirmar via cliente `anon` que `GET /rest/v1/marketing_leads` retorna acesso negado (`401`/`403` ou vazio sem permissão).
  - Nunca usar dados pessoais reais em testes automatizados.
