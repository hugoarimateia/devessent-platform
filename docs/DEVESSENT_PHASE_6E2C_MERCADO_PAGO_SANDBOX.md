# DEVESSENT PLATFORM — FASE 6E.2C
## Integração Oficial Mercado Pago Sandbox, Homologação Financeira e Preparação para Produção

> **Status da Fase 6E.2C:** **Implementação técnica, endurecimento fail-closed, suítes automatizadas e Preview Version Cloudflare Workers 100% concluídos e verificados.** A **homologação externa real na API oficial de testes do Mercado Pago** permanece **PENDENTE** exclusivamente da criação manual da aplicação Developers e das Contas de Teste (Vendedor + Comprador) pelo proprietário da conta DevEssent (autenticação pessoal / 2FA), seguida da gravação privada dos segredos via `wrangler versions secret put`. **Nenhuma evidência externa foi simulada ou presumida.**

---

## 1. Arquitetura Anterior (Fase 6E.2B) e Alterações da Fase 6E.2C

Na Fase 6E.2B (`fcdda16` / `3803935`), o módulo `src/modules/billing/` foi publicado em Staging (`devessent-platform-staging`, versão ativa `7c984c38-4e8d-4b9d-b093-889ab10222c4`) operando em `internal_sandbox_simulator` com segredo HMAC exclusivo (`BILLING_WEBHOOK_SANDBOX_SECRET`).

A auditoria inicial frente à documentação oficial atualizada do Mercado Pago e do Cloudflare Workers identificou **5 ajustes arquiteturais essenciais**, todos implementados nesta Fase 6E.2C sem alterar Retail Payments, Contratos 50/50, Landing Page, Catalog Scanner ou migrations existentes:

1. **Correção da estratégia de validação de credenciais (§4):** a validação anterior rejeitava qualquer token `APP_USR-*` por prefixo. Como credenciais de teste atuais do Mercado Pago também utilizam `APP_USR-*` (e `TEST-*` sozinho não comprova Sandbox), a validação passou a exigir **comprovação autoritativa em `GET /users/me`** (`tags` contendo `"test_user"`, `site_id === "MLB"` e `id === BILLING_MP_COLLECTOR_ID`).
2. **Seleção explícita de provedor (`BILLING_PROVIDER_MODE` — §6):** eliminada a alternância implícita pela mera presença de secrets. O sistema permanece em `internal_sandbox_simulator` até que `BILLING_PROVIDER_MODE=official_sandbox_api` seja definido explicitamente junto de todos os parâmetros obrigatórios. Erros de configuração bloqueiam apenas operações financeiras (*fail-closed*), preservando todas as páginas com diagnóstico administrativo seguro.
3. **Cobertura completa dos endpoints oficiais de Assinaturas (§7):** implementados `GET /users/me`, `POST /preapproval`, `GET /preapproval/{id}`, `PUT /preapproval/{id}`, `GET /preapproval/search`, `GET /authorized_payments/{id}`, `GET /authorized_payments/search` e `GET /v1/payments/{id}`, além de ações sob demanda no Console Admin (`Diagnosticar Provedor MP` e `Sincronizar Mercado Pago`) — sem polling em navegação.
4. **Endurecimento de Webhooks oficiais (§8):**
   - Suporte a timestamp `ts` do cabeçalho `x-signature` tanto em **10 dígitos (segundos)** quanto em **13 dígitos (milissegundos)**, preservando o valor exato no manifesto HMAC-SHA256.
   - Suporte aos 4 tópicos relevantes (`subscription_preapproval`, `subscription_authorized_payment`, `payment` vinculado à assinatura e `subscription_preapproval_plan` reconhecido e ignorado com segurança).
   - Verificação de titularidade (`collector_id`, `application_id` e `user_id`), correspondência estrita de `external_reference` e `external_subscription_id` (impedindo alteração cruzada entre empresas), modo explícito `BILLING_MP_WEBHOOK_AUTH_MODE` (`hmac_strict` padrão ou `authoritative_fallback` sem nunca fingir HMAC) e retorno HTTP `503 Service Unavailable` com registro `error` (`retryable: true`) em falhas temporárias do gateway ou do Supabase.
5. **Versionamento sem impacto em tráfego ativo (`wrangler versions upload` — §6 / §14):** adicionado o comando `pnpm cf:preview-version:staging` em `scripts/cf-staging.ts`, permitindo subir e testar uma Preview Version isolada antes de promover para o tráfego principal de Staging.

---

## 2. Provedor, Ambiente e Separação dos Três Fluxos

| Fluxo | Escopo | Status na Fase 6E.2C |
|---|---|---|
| **Fluxo A — Retail Payments** (Consumidor → Lojista) | `src/modules/retail/` | **Intocado** (4/4 testes PostgreSQL Staging aprovados; 0 imports cruzados) |
| **Fluxo B — Billing SaaS** (Lojista → DevEssent) | `src/modules/billing/` | **Integrado à API oficial Mercado Pago Sandbox** (aguardando credenciais da Conta de Teste DevEssent para ativação) |
| **Fluxo C — Implantação 50/50** (Lojista → DevEssent) | `src/modules/billing/` | **Intocado e manual** (sem checkout nem recorrência; comprovantes no bucket privado `billing-receipts`) |

---

## 3. Documentação Oficial Consultada

1. Mercado Pago Developers — Visão Geral da API de Assinaturas: https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview
2. Mercado Pago Developers — Criação de Assinatura (`POST /preapproval`): https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post
3. Mercado Pago Developers — Credenciais (incluindo formato `APP_USR-*` em credenciais de teste): https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/credentials
4. Mercado Pago Developers — Contas de Teste (Vendedor Collector e Comprador Payer do mesmo país `MLB`): https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/test/accounts
5. Mercado Pago Developers — Webhooks de Assinaturas (`subscription_preapproval`, `subscription_authorized_payment`, `subscription_preapproval_plan`, `payment`, `x-signature` HMAC-SHA256 e configuração sob a conta de teste): https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
6. Cloudflare Workers — Secrets e Gradual Deployments (`wrangler versions upload`, `wrangler versions secret put`, `wrangler versions deploy`): https://developers.cloudflare.com/workers/configuration/secrets/

---

## 4. Formatos de Credenciais e Estratégia Segura de Validação

- **Por que prefixo não basta:** o Mercado Pago emite credenciais de teste tanto com prefixo `TEST-` (legado/específico) quanto `APP_USR-` (contas de teste modernas). Bloquear `APP_USR-` impede usar Contas de Teste oficiais; confiar em `TEST-` sem consulta autoritativa não garante titularidade nem país.
- **Estratégia em 2 camadas (*fail-closed*):**
  1. **Camada estática (`resolveDevEssentBillingCredentials`):** exige `BILLING_PROVIDER_MODE=official_sandbox_api`, `BILLING_MP_ENVIRONMENT=sandbox` (bloqueia `production`/`live`), `BILLING_MP_ACCESS_TOKEN` com formato válido (`TEST-*` ou `APP_USR-*`, ≥ 24 chars, nunca compartilhado com segredos de Auth/Supabase/Retail), `BILLING_MP_COLLECTOR_ID` numérico e `BILLING_MP_WEBHOOK_SECRET` obrigatório quando `BILLING_MP_WEBHOOK_AUTH_MODE=hmac_strict`.
  2. **Camada autoritativa (`verifyOfficialSandboxCredentials` → `GET /users/me`, cache de 5 min por isolate):** antes de qualquer `POST /preapproval`, `PUT /preapproval/{id}`, consulta `GET /preapproval*`/`/authorized_payments*` ou reconciliação de webhook oficial, o adaptador confirma em `GET https://api.mercadopago.com/users/me`:
     - `tags` inclui **`"test_user"`** (bloqueia imediatamente qualquer conta real de produção!).
     - `site_id === "MLB"` (Brasil / BRL).
     - `String(id) === BILLING_MP_COLLECTOR_ID` (garante que o dinheiro de teste aponta exclusivamente para a Conta Vendedora de Teste da DevEssent).
  3. **Camada por recurso:** toda resposta de `/preapproval`, `/authorized_payments` e `/v1/payments` rejeita `live_mode === true`, `collector_id` divergente e `application_id` divergente.

---

## 5. Seleção Explícita do Provedor e Variáveis de Ambiente

| Variável / Secret | Tipo | Obrigatória em | Finalidade |
|---|---|---|---|
| `BILLING_PROVIDER_MODE` | Var/Secret | Opcional (padrão seguro: `internal_sandbox_simulator`) | Seleciona explicitamente `internal_sandbox_simulator` ou `official_sandbox_api`. Nunca alterna automaticamente pela presença de tokens. |
| `BILLING_WEBHOOK_SANDBOX_SECRET` | Cloudflare Secret | `internal_sandbox_simulator` | Segredo HMAC exclusivo (≥ 32 chars) do simulador interno. Nunca reutiliza Auth/Supabase/Retail. |
| `BILLING_MP_ENVIRONMENT` | Var/Secret | `official_sandbox_api` (padrão `sandbox`) | Deve ser exatamente `sandbox`; qualquer outro valor (`production`/`live`) falha fechado. |
| `BILLING_MP_ACCESS_TOKEN` | Cloudflare Secret | `official_sandbox_api` | Access Token da Conta Vendedora de Teste DevEssent (`APP_USR-*` ou `TEST-*`), comprovado via `/users/me`. |
| `BILLING_MP_COLLECTOR_ID` | Var/Secret | `official_sandbox_api` | `id` numérico da Conta Vendedora de Teste DevEssent (validado contra `/users/me` e recursos). |
| `BILLING_MP_WEBHOOK_SECRET` | Cloudflare Secret | `official_sandbox_api` (`hmac_strict`) | Assinatura secreta de Webhooks gerada no painel Mercado Pago Developers (≥ 16 chars). |
| `BILLING_MP_APPLICATION_ID` | Var/Secret | Opcional (`official_sandbox_api`) | `application_id` numérico da aplicação Developers para validação adicional de origem. |
| `BILLING_MP_WEBHOOK_AUTH_MODE` | Var/Secret | Opcional (padrão `hmac_strict`) | `hmac_strict` exige `x-signature` HMAC válido; `authoritative_fallback` aceita tópico sem `x-signature` marcando `signature_verified=false` e exigindo consulta autoritativa + titularidade. |

---

## 6. Endpoints, Fluxo de Autorização, Webhooks e Estados

- **Endpoints integrados em `MercadoPagoBillingProvider`:**
  - `GET /users/me` — comprovação fail-closed de Conta de Teste (`test_user` + `MLB` + `collector_id`).
  - `POST /preapproval` — criação de solicitação de assinatura (`status: "pending"`, `X-Idempotency-Key`, `auto_recurring` em BRL, `external_reference`, `payer_email`, `back_url`).
  - `GET /preapproval/{id}` e `GET /preapproval/search` — consulta autoritativa de status do contrato.
  - `PUT /preapproval/{id}` — atualização/cancelamento externo.
  - `GET /authorized_payments/{id}` e `GET /authorized_payments/search` — consulta autoritativa das cobranças recorrentes.
  - `GET /v1/payments/{id}` — acompanhamento de pagamento vinculado à assinatura quando notificado pelo tópico `payment`.
  - *Nota sobre `/preapproval_plan`:* a DevEssent controla planos e condições individualizadas localmente no PostgreSQL, evitando duplicação desnecessária de planos externos; notificações `subscription_preapproval_plan` são reconhecidas (`200 ignored_plan_topic`) sem mutação.
- **Fluxo de autorização e estados:**
  - O retorno do navegador (`back_url`) **nunca** é tratado como confirmação financeira; em `official_sandbox_api`, a autorização simulada pelo painel local é bloqueada (`403`) e o cliente utiliza o link oficial (`Autorizar no Mercado Pago (Sandbox)`).
  - Máquina de estados preservada: `awaiting_authorization` → `awaiting_activation` (quando autorizado antes da data contratual ou do marco de entrega) → `active` → `pending_payment` / `past_due` (sem jamais alterar `tenants.status` nem derrubar a vitrine) → `in_regularization` → `cancel_scheduled` → `cancelled`.
- **Restrições oficiais confirmadas para Webhooks em Assinaturas sem plano (`POST /preapproval`):**
  - `POST /preapproval` **não aceita `notification_url`** no corpo JSON (diferente de Checkout Pro `/checkout/preferences` ou `/v1/payments`; enviar `notification_url` em `/preapproval` é ignorado).
  - As notificações devem ser habilitadas globalmente no painel **Suas integrações → Webhooks → Configurar notificações → Modo de teste** da **mesma aplicação proprietária do Access Token da Conta Vendedora de Teste** (configurar o webhook em uma aplicação diferente daquela que emitiu o token impede o recebimento ou invalida o `Secret Key`).
  - **Tópicos e `x-signature`:** Webhooks modernos configurados no painel para `subscription_preapproval`, `subscription_authorized_payment` e `payment` enviam `POST` JSON com `x-signature` (`ts` em 10 ou 13 dígitos + `v1` HMAC-SHA256) e `x-request-id`. Contudo, notificações legadas/IPN (ex.: `?id=...&topic=preapproval` com corpo vazio) podem chegar sem `x-signature`, `body.id` ou `x-request-id`.
  - **Correção aplicada na continuação 6E.2C:**
    1. Quando `x-signature` está presente, a assinatura HMAC-SHA256 é **sempre** validada estritamente (`401` se inválida — inclusive em `authoritative_fallback`).
    2. Quando uma notificação sem `body.id`/`x-request-id` chega sob `BILLING_MP_WEBHOOK_AUTH_MODE=authoritative_fallback`, o sistema registra `signature_verified = false` honestamente, consulta o estado autoritativo na API oficial (`GET /users/me` + `GET /preapproval/{id}` ou `/authorized_payments/{id}` ou `/v1/payments/{id}` + verificação de `live_mode`, `collector_id`, `application_id` e `external_reference`) e deriva a chave idempotente com o estado autoritativo (`ipn:<resourceType>:<id>:<status>`), garantindo que transições reais `pending → authorized → cancelled` nunca sejam descartadas como duplicadas enquanto reenvios do mesmo estado permanecem idempotentes.
    3. Em `GET /v1/payments/{id}`, o vínculo com a assinatura é resolvido tanto por `metadata.preapproval_id` quanto por `point_of_interaction.transaction_data.subscription_id`, `preapproval_id` e `external_reference`.
- **Reconciliação de Webhooks (`/api/webhooks/billing/mercado_pago`):**
  - Valida rate limit, tamanho (≤ 64 KB), `live_mode !== true`, assinatura HMAC-SHA256 (`ts` em segundos ou milissegundos, janela ±5 min), titularidade (`collector_id`/`application_id`), consulta autoritativa na API oficial, correspondência estrita de `external_reference` e `external_subscription_id` (proteção cross-tenant) e executa `reconcile_billing_invoice_tx` (lock pessimista + idempotência + proteção contra eventos fora de ordem).
  - Em falhas temporárias da API Mercado Pago ou do Supabase, retorna **HTTP `503`** (`Retry-After: 30`) e grava `processing_status = 'error'` com `retryable: true` para reprocessamento seguro.

---

## 7. Classificação Transparente dos Testes (6 Níveis — §16D)

| Nível | Status | Evidência Real Verificada |
|---|---|---|
| **1. Mock Unitário** (`tests/unit/billing/mercado-pago-official-sandbox.test.ts` + `billing-domain-and-security.test.ts` + suíte completa) | **PASS (23/23 arquivos · 123/123 testes)** | Validação `APP_USR-*` e `TEST-*` via `/users/me` (`test_user`, bloqueio sem `test_user`, país `MLA`, collector divergente), seleção explícita `BILLING_PROVIDER_MODE`, `POST/GET/PUT /preapproval`, `/preapproval/search`, `/authorized_payments/search`, `/v1/payments/{id}`, `ts` 10 e 13 dígitos, `authoritative_fallback` (`signatureVerified=false`), indisponibilidade `503` e `getRuntimeStatus()` fail-safe |
| **2. Simulador Interno** (`internal_sandbox_simulator`) | **PASS** | Exercita HMAC-SHA256 com segredo exclusivo `BILLING_WEBHOOK_SANDBOX_SECRET`, `providerOrigin = "internal_sandbox_simulator"`, bloqueado em produção e quando `official_sandbox_api` estiver ativa |
| **3. Runtime Local / Integração Real PostgreSQL Cloud Staging** (`billing-supabase-security.test.ts` + `retail-payments-supabase-staging.test.ts` contra `auebnppzxcvtaaqqlbts`) | **PASS (2/2 suítes · 6/6 testes)** | RLS multiempresa Billing, bloqueio `manager`/`staff`, idempotência, inadimplência sem suspensão, confirmação única 50/50 e **4/4 Retail Payments intactos** |
| **4. Cloudflare Staging — Versão Preview Não-Ativa** (`https://9fd05285-devessent-platform-staging.devessent.workers.dev`, Version ID `9fd05285-d109-4444-bdbe-1e0403c7772f`) | **PASS (`0 pageErrors` · `0 HTTP 5xx`)** | Health `200`, botão sob demanda `Diagnosticar Provedor MP`, webhook com `ts` de 13 dígitos (`200 processed`), `subscription_preapproval_plan` (`200 ignored_plan_topic`), evento fora de ordem (`200 ignored_out_of_order`), HMAC forjado (`401`), RBAC (`owner_verde` sem vazamento + `/forbidden` em `/admin/comercial`), Retail intacto (`orders=7, payments=1, connections=2`), seed Staging limpo |
| **5. API Oficial de Testes Mercado Pago** (`api.mercadopago.com` real com Conta de Teste DevEssent) | **PENDENTE** | Requer criação manual da aplicação Developers e das Contas de Teste (Vendedor + Comprador) pelo proprietário da conta DevEssent e gravação privada dos segredos via `wrangler versions secret put` |
| **6. Evento Externo Efetivamente Recebido do Provedor Mercado Pago** | **PENDENTE** | Depende do passo 5 (URL webhook já pronta: `https://devessent-platform-staging.devessent.workers.dev/api/webhooks/billing/mercado_pago`) |

---

## 8. Consumo Cloudflare Workers, Performance e Rollback

- **Artefato `cf:build:staging`:** `2,63 MiB` descomprimido (`4,1%` do limite de 64 MiB), **`668,03 KiB` gzip no upload Cloudflare** (`0,65 MiB` vs limite de `3 MiB` do plano Free), startup `55 ms`, zero `mysql2`/XAMPP/segredos no bundle.
- **Latências medidas online na Preview URL (`9fd05285`, full-reload `networkidle`, 5 amostras):**
  - `/dashboard/assinatura`: p50 **`929 ms`** / p95 `1232 ms` (melhor que `/dashboard` graças ao prefetch paralelo RLS)
  - `/admin/comercial`: p50 **`1012 ms`** / p95 `1195 ms`
  - `/dashboard/retail`: p50 **`1059 ms`** / p95 `1167 ms`
  - `/dashboard`: p50 **`1124 ms`** / p95 `1224 ms`
  - Webhook `/api/webhooks/billing/mercado_pago`: `1198 ms` (inclui TLS + HMAC + RPC transacional PostgreSQL Cloud)
- **Zero polling:** nenhuma chamada à API Mercado Pago ocorre durante navegação nas páginas.
- **Política de Cron/Filas:** não foram criados Cron Triggers nem Cloudflare Queues pagos nesta fase (reconciliação dirigida por webhooks + ação sob demanda `Sincronizar Mercado Pago`).
- **Estratégia de Rollback preservada:**
  - Versão ativa atual de Staging (Fase 6E.2B · `fcdda16`): `7c984c38-4e8d-4b9d-b093-889ab10222c4` (inalterada).
  - Versão Preview da Fase 6E.2C (`2369c8b`): `9fd05285-d109-4444-bdbe-1e0403c7772f` (`https://9fd05285-devessent-platform-staging.devessent.workers.dev`).
  - Rollback de referência da Fase 6E.1 (`6ba6c41`): `9d82b763-dc9c-4308-b966-4ed72ba0a028`.
  - Comando de rollback imediato: `npx wrangler rollback <VERSION_ID> --name devessent-platform-staging`.

---

## 9. Passos Manuais Pendentes (Proprietário DevEssent — Sem Compartilhar Segredos no Chat)

### Etapa A — Criar Aplicação e Contas de Teste no Mercado Pago Developers

1. **URL oficial do painel:** https://www.mercadopago.com.br/developers/panel/app (autenticar com a conta oficial da **DevEssent** — 2FA pessoal do proprietário).
2. **Caminho de menu:** *Suas integrações* → **Criar aplicação**.
3. **Nome sugerido:** `DevEssent Platform Billing Staging`.
4. **Produto de integração:** **Pagamentos online** → **Assinaturas (Plans and Subscriptions / Checkout API)**.
5. **Contas de teste (*Suas integrações → Contas de teste → Criar conta de teste*, país Brasil / `MLB`):**
   - **Conta Vendedora de Teste (Collector — DevEssent Sandbox):** anote o **User ID numérico** (`BILLING_MP_COLLECTOR_ID`) e o login de teste.
   - **Conta Compradora de Teste (Payer — Lojista Sandbox):** anote o e-mail `test_user_...@testuser.com` e a senha de teste (jamais usar conta pessoal real nem cartão real!).
6. **Obter Credenciais de Teste:** faça login no painel Developers usando a **Conta Vendedora de Teste** (ou acesse *Credenciais de teste* da aplicação) e copie o **Access Token de teste** (`APP_USR-...` ou `TEST-...`) e o **ID da aplicação** (`application_id`, opcional).
7. **Configurar Webhooks em Modo de Teste** (*Suas integrações → sua aplicação → Webhooks → Configurar notificações → Modo de teste*):
   - **URL de teste:** `https://devessent-platform-staging.devessent.workers.dev/api/webhooks/billing/mercado_pago`
   - **Eventos:** marque **Planos e assinaturas** (`subscription_preapproval`, `subscription_authorized_payment`, `subscription_preapproval_plan`) e **Pagamentos** (`payment`).
   - Salve e copie a **Assinatura secreta** (`BILLING_MP_WEBHOOK_SECRET`).

### Etapa B — Procedimento Simples e Atômico para Criar Preview Version Oficial (Sem Expor Segredos e Sem Afetar Staging Ativo)

> **Comportamento comprovado no Wrangler `4.165.0`:** `wrangler versions secret put` e `wrangler versions secret bulk` executam `PATCH /accounts/{accountId}/workers/workers/{scriptName}/versions/latest`, clonando a **última versão enviada** (código + assets + vars Supabase + segredos já existentes) sem ativá-la no tráfego principal. Para evitar versões intermediárias quebradas ou baseadas acidentalmente na revisão antiga `7c984c38`, utilize o comando atômico `pnpm cf:mp-sandbox-preview:staging`, que:
> 1. Pré-valida localmente `BILLING_MP_ACCESS_TOKEN` em `GET https://api.mercadopago.com/users/me` (`tags: ["test_user"]`, `site_id: "MLB"` e `id === BILLING_MP_COLLECTOR_ID` — falha fechado antes de enviar qualquer segredo ao Cloudflare!).
> 2. Envia o código 6E.2C (`wrangler versions upload --tag fase-6e2c-code`).
> 3. Aplica todos os segredos oficiais em **um único `wrangler versions secret bulk` via stdin** (`--tag fase-6e2c-mp-sandbox-preview`), sem arquivos temporários e sem imprimir valores, **preservando integralmente** a versão ativa `7c984c38`, os bindings Supabase e os 4 segredos existentes.

1. Adicione localmente em `.env.staging.local` (arquivo ignorado pelo Git; jamais compartilhar no chat):
   ```dotenv
   BILLING_MP_ENVIRONMENT=sandbox
   BILLING_MP_ACCESS_TOKEN=<access_token_da_conta_vendedora_de_teste>
   BILLING_MP_COLLECTOR_ID=<user_id_numerico_da_conta_vendedora_de_teste>
   BILLING_MP_WEBHOOK_SECRET=<assinatura_secreta_webhooks_modo_teste>
   # Opcional:
   BILLING_MP_APPLICATION_ID=<application_id_numerico>
   BILLING_MP_WEBHOOK_AUTH_MODE=hmac_strict
   ```
2. Execute no PowerShell local (perfil `devessent`, conta `bf89f7f990af2c019abf8e7604db760d`):
   ```powershell
   $env:CLOUDFLARE_ACCOUNT_ID = "bf89f7f990af2c019abf8e7604db760d"
   $env:NEXT_PUBLIC_APP_URL = "https://devessent-platform-staging.devessent.workers.dev"
   pnpm cf:build:staging
   pnpm cf:mp-sandbox-preview:staging
   ```
3. Anote a **Preview URL** impressa (`https://<8chars>-devessent-platform-staging.devessent.workers.dev`), cadastre-a temporariamente como URL de Webhooks de Teste no painel Mercado Pago para homologar na Preview isolada (ou valide `Diagnosticar Provedor MP` em `/admin/comercial`) e **somente após aprovação final** execute `npx wrangler versions deploy --name devessent-platform-staging`.

### Etapa C — Como Confirmar Conclusão Sem Compartilhar Credenciais

Após concluir as Etapas A e B, basta informar que os segredos foram gravados e a versão promovida (sem colar tokens ou senhas no chat). A homologação externa oficial poderá então executar: criação real em `POST /preapproval`, consentimento na Conta Compradora de Teste, consulta `GET /preapproval/{id}` + `GET /authorized_payments/search`, validação dos webhooks externos com `providerOrigin = "mercado_pago_official_sandbox"` e cancelamento via `PUT /preapproval/{id}`.

---

## 10. Limitações do Sandbox e Pendências para Produção

- **Limitações conhecidas do Mercado Pago Sandbox:** ciclos recorrentes mensais não aceleram no relógio em tempo real (testam-se cobranças subsequentes com `start_date` próximo ou Simulador de Webhooks do painel); `payer_email` deve obrigatoriamente ser da Conta Compradora de Teste (`@testuser.com`); a régua interna de retentativas do Mercado Pago não é customizável via API.
- **Pendências para Produção:**
  1. Concluir homologação externa oficial na Conta de Teste (Etapa 5/6 com eventos reais do Mercado Pago).
  2. Definir política comercial definitiva (planos, carência de inadimplência, reajuste anual e termos jurídicos).
  3. Configurar envio transacional de notificações consumindo `billing_notifications_queue`.
  4. Avaliar plano Cloudflare Workers Paid (`$5/mês`) para folga adicional de CPU em Produção.
  5. Provisionar ambiente de Produção dedicado (Supabase Produção + Worker Produção + secrets live ativados somente mediante aprovação explícita).
  6. Executar em trilha separada o onboarding financeiro individual dos estabelecimentos para o Fluxo A (Retail Payments).
