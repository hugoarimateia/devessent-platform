# DevEssent Platform — Billing SaaS, Assinaturas Recorrentes e Contratos 50/50

> **Documentação Técnica e Operacional — Fase 6E.2**
>
> - **Módulo isolado:** `src/modules/billing/`
> - **Migration aditiva:** `supabase/migrations/20260301000015_saas_billing_and_contracts.sql`
> - **Ambiente validado:** Supabase Cloud Staging (`auebnppzxcvtaaqqlbts`) + Cloudflare Workers runtime (`workerd`)
> - **Status comercial:** **Exclusivamente Sandbox (cobranças reais desabilitadas *fail-closed*)**

---

## 1. Arquitetura do Billing SaaS

O módulo **DevEssent Billing SaaS** (`src/modules/billing/`) administra as receitas próprias da software house DevEssent de forma desacoplada da operação de e-commerce dos clientes:

```
src/modules/billing/
 ├── types/billing.types.ts                         (Contratos TypeScript dos fluxos B e C)
 ├── domain/billing-invariants.ts                   (Regras puras: centavos, 50/50, MRR, magic bytes, fail-closed)
 ├── schemas/billing.schema.ts                      (Validações Zod)
 ├── permissions/billing-permissions.ts             (Matriz RBAC exclusiva: platform_admin e owner)
 ├── providers/
 │   ├── billing-provider.interface.ts              (Interface desacoplada de provedores recorrentes)
 │   └── mercado-pago-billing.provider.ts           (Adaptador Mercado Pago /preapproval + simulador Sandbox)
 ├── services/
 │   ├── billing-plan-service.ts                    (Planos comerciais, versionamento e histórico)
 │   ├── billing-subscription-service.ts            (Assinaturas, autorização, ativação, cancelamento, KPIs)
 │   ├── billing-webhook-service.ts                 (Webhooks HMAC-SHA256 + reconciliação atômica)
 │   └── implementation-contract-service.ts         (Contratos 50/50, comprovantes e confirmações manuais)
 ├── actions/billing.actions.ts                     (Server Actions autorizadas)
 └── components/
     ├── admin-billing-console.tsx                  (Console global exclusivo /admin/comercial)
     └── tenant-subscription-panel.tsx              (Visão restrita do empresário /dashboard/assinatura)
```

---

## 2. Separação Oficial dos Três Fluxos Financeiros

A arquitetura impõe separação física (tabelas, endpoints, segredos, buckets) e de código (verificada automaticamente por `pnpm check:project`, que proíbe imports cruzados `billing <-> retail`):

| Dimensão | Fluxo A — Retail Payments | Fluxo B — Billing SaaS | Fluxo C — Contratos 50/50 |
|---|---|---|---|
| **Quem paga / Quem recebe** | Consumidor → Estabelecimento cliente | Empresário → DevEssent | Empresário → DevEssent |
| **Módulo** | `src/modules/retail/` *(intocado)* | `src/modules/billing/` | `src/modules/billing/` |
| **Tabelas** | `retail_payment_*`, `retail_orders` | `billing_plans`, `billing_subscriptions`, `billing_invoices`, `billing_webhook_events` | `implementation_contracts`, `implementation_installments`, `implementation_contract_history` |
| **Endpoint de Webhook** | `/api/webhooks/retail/payments/[provider]` | `/api/webhooks/billing/[provider]` | Nenhum (controle manual auditado) |
| **Conta Recebedora** | Conta individual conectada por cada loja | Exclusivamente conta da DevEssent | Recebimento direto negociado (Pix/TED/presencial) |
| **Storage** | `retail-media` (imagens de catálogo) | — | `billing-receipts` (bucket privado, restrito a `platform_admin`) |
| **Segredos** | `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` + chaves por tenant | `BILLING_MP_ACCESS_TOKEN`, `BILLING_MP_WEBHOOK_SECRET` | — |

Nenhum evento Retail pode quitar uma mensalidade Billing, nenhum webhook Billing pode alterar pedidos Retail e nenhuma credencial financeira de estabelecimento pode ser usada para faturar mensalidades da DevEssent.

---

## 3. Modelagem do Banco de Dados

Migration aditiva aplicada em `auebnppzxcvtaaqqlbts`: **`20260301000015_saas_billing_and_contracts.sql`** (sem alterar nenhuma migration anterior nem nenhuma tabela Retail).

**11 tabelas criadas (todas com `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`):**

1. `billing_plans` — Catálogo de planos SaaS (código único, versão, valor em centavos, ciclo, serviços incluídos, flag `is_demo`).
2. `billing_plan_history` — Histórico imutável de criação, reajustes, desativação e reativação de planos.
3. `billing_subscriptions` — Contrato recorrente individual por empresa com snapshot de plano/versão/valor, status da máquina de estados, datas de autorização/ativação/início agendado, metadados mascarados do meio de pagamento e índice parcial único `uq_billing_subscriptions_one_open_per_tenant` (`WHERE status <> 'cancelled'`).
4. `billing_subscription_history` — Trilha imutável de transições de status, reajustes contratuais e exceções registradas.
5. `billing_invoices` — Faturas recorrentes em centavos com unicidade `UNIQUE (subscription_id, billing_cycle_key)` e `idempotency_key UNIQUE`.
6. `billing_invoice_attempts` — Histórico de tentativas de cobrança por fatura.
7. `billing_webhook_events` — Log idempotente de eventos do provedor (`UNIQUE (provider, external_event_id)`).
8. `billing_notifications_queue` — Fila/log auditável de avisos e lembretes (sem disparo externo automático em Staging).
9. `implementation_contracts` — Contratos de implantação 50/50 independentes (`CHECK (entry_percent + balance_percent = 100)`).
10. `implementation_installments` — Parcelas manuais (Entrada 50% e Saldo 50%), distinguindo `pending`, `receipt_attached` e `confirmed`, com `idempotency_confirm_key UNIQUE`.
11. `implementation_contract_history` — Trilha imutável de eventos do contrato de implantação.

**2 RPCs transacionais `SECURITY DEFINER` (`REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role`):**
- `reconcile_billing_invoice_tx(...)`
- `confirm_implementation_installment_tx(...)`

---

## 4. Planos Comerciais (`billing_plans`)

- Suportam periodicidade `monthly`, `quarterly`, `semiannual` e `annual`, com valores inteiros em centavos (`BRL`).
- Cada alteração de plano incrementa `version` e registra `billing_plan_history` com motivo obrigatório.
- **Proteção contratual:** reajustes futuros em um plano **jamais alteram silenciosamente** o `contracted_amount_cents` nem o `plan_version_snapshot` de assinaturas já contratadas.
- Nenhum plano comercial definitivo foi inserido automaticamente em Staging; planos demonstrativos podem ser criados sob demanda em `/admin/comercial`.

---

## 5. Assinaturas (`billing_subscriptions`)

- Cada empresa pode manter no máximo 1 assinatura aberta simultaneamente (`status <> 'cancelled'`).
- Registra valor contratual acordado (`contracted_amount_cents`), periodicidade, data agendada de início (`scheduled_start_date`), tolerância de inadimplência (`grace_period_days`, padrão 7 dias), nome do responsável pelo aceite e observações administrativas.
- **Métricas fiéis:** o indicador **MRR Ativo** considera exclusivamente assinaturas em estado `active` ou `cancel_scheduled` (normalizadas para equivalente mensal em centavos). Faturas `pending`, `processing`, `failed` ou `overdue` **nunca** são contabilizadas como receita recebida.

---

## 6. Datas de Ativação e Início Agendado

O sistema aplica a regra contratual estrita `BillingInvariants.evaluateBillingStartReadiness()`:
1. A assinatura não pode estar `cancelled`.
2. Exige autorização financeira válida do empresário (`authorized_at IS NOT NULL`).
3. Exige confirmação explícita do marco contratual de ativação pela DevEssent (`activation_confirmed_at IS NOT NULL`).
4. Exige que a data agendada (`scheduled_start_date`) já tenha sido atingida (`scheduled_start_date <= hoje`).

Enquanto qualquer critério não for atendido, nenhuma cobrança recorrente pode ser iniciada.

---

## 7. Autorização de Cobranças e Proteção de Dados de Cartão

- O fluxo prioritário da v1 é **Cartão de Crédito Recorrente** via fluxo hospedado/tokenizado do provedor.
- A DevEssent Platform **nunca armazena número completo de cartão (PAN), data completa de expiração ou CVV** — persiste exclusivamente `payment_method_brand` (ex.: `Visa`), `payment_method_last4` (`4` dígitos) e o identificador externo da assinatura no provedor.
- A estrutura já prevê `payment_method_type = 'pix_automatic_future'` para suportar **Pix Automático** em etapa futura, sem confundi-lo com Pix manual avulso.

---

## 8. Provedores Avaliados (Mercado Brasileiro)

| Provedor | Pontos Fortes para DevEssent SaaS | Limitações / Observações |
|---|---|---|
| **Mercado Pago Assinaturas (`/preapproval`)** *(selecionado como adaptador principal v1)* | Alinhamento com o ecossistema já estudado na plataforma; API oficial no Brasil com `start_date`, webhooks HMAC (`subscription_preapproval` e `subscription_authorized_payment`), cartão recorrente e evolução de Pix Automático PJ | API nativa `/preapproval` foca em cartão de crédito; controle de régua de retentativas é gerenciado pelo provedor; Sandbox possui limitações de simulação antifraude |
| **Asaas** *(alternativa avaliada)* | Excelente recorrência brasileira (cartão, boleto, Pix), emissão de NF-e e régua de cobrança configurável | Exige credenciamento separado e novo contrato de conta PJ; fácil de plugar futuramente via interface `BillingProvider` |
| **Stripe Brasil** *(alternativa avaliada)* | Melhor DX global para SaaS, Billing Portal nativo e gestão avançada de *dunning* | Cartão recorrente maduro, porém Pix recorrente/automático menos nativo no mercado local e custos típicos mais elevados em BRL |

Por causa da interface desacoplada `BillingProvider` (`src/modules/billing/providers/billing-provider.interface.ts`), a DevEssent pode adicionar Asaas ou Stripe no futuro sem alterar banco, serviços de domínio ou telas.

---

## 9. API Utilizada

O adaptador `MercadoPagoBillingProvider` implementa os endpoints oficiais do Mercado Pago para o Brasil:
- `POST /preapproval` (criação de pré-aprovação/assinatura com `auto_recurring.start_date`, `frequency`, `frequency_type: "months"`, `currency_id: "BRL"`, `external_reference`, `back_url`)
- `PUT /preapproval/{id}` (cancelamento externo)
- `GET /preapproval/{id}` (consulta autoritativa de contrato)
- `GET /authorized_payments/{id}` (consulta autoritativa de cobrança recorrente)

**Transparência operacional (Fase 6E.2C):** o modo do provedor é selecionado explicitamente por `BILLING_PROVIDER_MODE` (`internal_sandbox_simulator` por padrão seguro até ativação explícita de `official_sandbox_api`). Credenciais de teste oficiais do Mercado Pago (`APP_USR-*` de Conta de Teste ou `TEST-*`) são aceitas **exclusivamente** após comprovação autoritativa via `GET /users/me` (`tags: ["test_user"]`, `site_id: "MLB"` e `collector_id` correspondente); contas reais sem `test_user` são bloqueadas *fail-closed*.

---

## 10. Webhooks Exclusivos do Billing SaaS

- **Endpoint dedicado:** `POST /api/webhooks/billing/[provider]` (ex.: `/api/webhooks/billing/mercado_pago`).
- **Rate limit próprio:** `RATE_LIMIT_POLICIES.billingWebhook` (escopo `billing:saas_webhook`, 120 req/min por IP/provedor).
- **Segurança:**
  - Limite de payload de 64 KB.
  - Validação obrigatória de `x-signature` (`ts=...,v1=...`) via HMAC-SHA256 sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com comparação em tempo constante (`timingSafeEqual`) e janela de timestamp de ±5 minutos.
  - Rejeição *fail-closed* de eventos `live_mode: true`.
  - Consulta autoritativa ao recurso no provedor antes de reconciliar (nunca confia apenas no corpo recebido ou em retorno do navegador).

---

## 11. Idempotência e Controle de Concorrência

- `billing_webhook_events` impõe `UNIQUE (provider, external_event_id)`: notificações repetidas retornam `outcome: "duplicate"` sem reprocessar nem duplicar faturas/tentativas.
- `billing_invoices` impõe `UNIQUE (subscription_id, billing_cycle_key)`: retentativas de um mesmo ciclo atualizam a fatura existente e incrementam `attempt_count`, sem criar duas cobranças para o mesmo mês.
- `reconcile_billing_invoice_tx` usa lock pessimista `FOR UPDATE` em `billing_subscriptions` e `billing_invoices`, além de impedir downgrade indevido de fatura já paga por eventos atrasados (`ignored_out_of_order`).
- `confirm_implementation_installment_tx` usa `FOR UPDATE` e `idempotency_confirm_key UNIQUE` para impedir confirmação dupla de parcelas 50/50.

---

## 12. Política de Inadimplência

Máquina de estados clara em `billing_subscriptions.status`:
- `awaiting_authorization` → `awaiting_activation` → `active`
- Falha inicial: `pending_payment` (primeira recusa **não** cancela a assinatura nem suspende a loja)
- Reincidência / atraso: `past_due` (sinaliza alerta administrativo no painel global com `delinquent_since`)
- Atualização de cartão pelo empresário: `in_regularization`
- Regularização confirmada por webhook: retorno automático para `active` com `delinquent_since = NULL` e `consecutive_failed_charges = 0`

**Regra de continuidade (§9):** nenhuma loja pública (`tenants.status`) é suspensa automaticamente por falha de cobrança. Comunicações são registradas em `billing_notifications_queue` com status `logged_sandbox` sem disparos externos reais.

---

## 13. Cancelamento

- **Cancelamento agendado (`at_period_end`):** transita para `cancel_scheduled`, mantém acesso até o fim do ciclo atual e impede renovação (`next_billing_date = NULL` após fechamento).
- **Cancelamento imediato (`immediate`):** notifica o provedor externo (`PUT /preapproval/{id}` com `status: "cancelled"`), grava `cancelled_at` e `cancellation_reason` em histórico e auditoria.

---

## 14. Contratos de Implantação 50/50 (Fluxo C)

- Independentes das mensalidades recorrentes (`implementation_contracts` + `implementation_installments`).
- Cálculo em centavos inteiros (`BillingInvariants.calculateImplementationSplit`): garante exatamente `entryCents + balanceCents === totalAmountCents` mesmo para valores ímpares.
- Padrão `50%` entrada + `50%` saldo na entrega; percentuais excepcionais exigem preenchimento obrigatório de `customTermsNote`.
- Não possui checkout automático nem cria assinatura recorrente para representar parcelas de implantação.

---

## 15. Recebimentos Manuais e Comprovantes

- Formas registradas: Pix manual, transferência bancária (TED/DOC), dinheiro/presencial, boleto manual, maquininha presencial ou outro meio acordado.
- **Distinção rigorosa (§10):**
  - Anexar comprovante (PDF, PNG, JPEG ou WebP até 5 MB, validado por assinatura binária *magic bytes* + SHA-256 no bucket privado `billing-receipts`) muda a parcela **apenas** para `receipt_attached` (*comprovante anexado — não confirmado*).
  - Somente a confirmação manual explícita pelo `platform_admin` via `confirm_implementation_installment_tx` altera para `confirmed`, contabiliza o valor recebido e grava quem confirmou, quando, o método e a observação.

---

## 16. Permissões (RBAC)

| Operação | `platform_admin` | `owner` | `manager` | `staff` |
|---|---|---|---|---|
| Painel global `/admin/comercial` | Sim | Não (`/forbidden`) | Não (`/forbidden`) | Não (`/forbidden`) |
| Criar/editar planos, contratos 50/50, confirmar parcelas | Sim | Não | Não | Não |
| Simular ciclos Sandbox / ver webhooks | Sim | Não | Não | Não |
| Visualizar `/dashboard/assinatura` (própria empresa) | Sim | Sim | Não (`/forbidden`) | Não (`/forbidden`) |
| Autorizar recorrência / atualizar cartão (própria empresa) | Sim | Sim | Não | Não |
| Alterar valor contratual ou quitar fatura manualmente | Sim (auditado) | Não | Não | Não |

---

## 17. Isolamento Multiempresa (RLS)

- Todas as 11 tabelas possuem `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`.
- `owner` possui exclusivamente política `FOR SELECT` restrita a `is_tenant_active(tenant_id) AND has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'])`.
- `manager`, `staff` e `anon` recebem `0` linhas em consultas diretas via PostgREST.
- Nenhuma política de escrita existe para usuários de tenant; toda mutação ocorre via `platform_admin` ou via Server Actions validadas + RPCs exclusivas de `service_role`.

---

## 18. Segurança e Performance no Cloudflare Workers

- **Seleção explícita de modo e segredos exclusivos no servidor (fail-closed — Fases 6E.2B e 6E.2C):**
  - A seleção entre `internal_sandbox_simulator` e `official_sandbox_api` é controlada **explicitamente** por `BILLING_PROVIDER_MODE` (nunca alterna automaticamente apenas pela presença de tokens).
  - No modo `internal_sandbox_simulator`: exige exclusivamente `BILLING_WEBHOOK_SANDBOX_SECRET` (≥ 32 caracteres de alta entropia), rejeitando *fail-closed* qualquer ausência, padrão previsível ou reutilização de `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_BRIDGE_SECRET` ou `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`.
  - No modo `official_sandbox_api`: exige `BILLING_MP_ENVIRONMENT=sandbox`, `BILLING_MP_ACCESS_TOKEN` (suporta formatos oficiais `APP_USR-*` de Conta de Teste e `TEST-*`), `BILLING_MP_COLLECTOR_ID` numérico e `BILLING_MP_WEBHOOK_SECRET` (em `hmac_strict`), comprovando autoritativamente via **`GET /users/me`** que o token pertence a uma Conta de Teste (`tags: ["test_user"]`, `site_id: "MLB"` e `collector_id` correspondente) antes de qualquer operação financeira.
  - Endpoints de simulação de cobrança são restritos exclusivamente a `platform_admin` em ambiente não-produtivo (`staging`/`development`) e desabilitados automaticamente quando `official_sandbox_api` estiver ativa. A rota pública `/api/webhooks/billing/[provider]` aceita exclusivamente `mercado_pago`, suportando `ts` em segundos (10 dígitos) e milissegundos (13 dígitos) no cabeçalho `x-signature`.
  - Todo evento persistido em `billing_webhook_events.payload_summary` e `audit_logs.metadata` grava explicitamente `providerOrigin` (`internal_sandbox_simulator` vs `mercado_pago_official_sandbox`), `authMethod` e `hmacSignatureVerified`.
- **Zero impacto nas demais páginas da plataforma:** `resolveWorkspaceSession()` permanece intocado — nenhuma consulta Billing nem chamada externa à API do Mercado Pago é executada durante a navegação das páginas.
- **Pré-busca paralela RLS-enforced:** `/dashboard/assinatura` utiliza `getActiveTenantHintUuid()` em paralelo com `resolveWorkspaceSession()`, preservando as otimizações das Fases 6D.2 e 6E.1.
- **Impacto de bundle Workers (`vinext`):** `2,63 MiB` descomprimido (`4,1%` do limite de `64 MiB`), **`668,03 KiB` gzip no upload Cloudflare** (`0,65 MiB` vs limite de `3 MiB` do plano Free).

> Para o detalhamento completo da integração oficial Mercado Pago Sandbox, verificação `/users/me`, versionamento não-ativo (`wrangler versions upload` / `wrangler versions secret put`) e guia passo a passo de criação das Contas de Teste, consulte [DEVESSENT_PHASE_6E2C_MERCADO_PAGO_SANDBOX.md](./DEVESSENT_PHASE_6E2C_MERCADO_PAGO_SANDBOX.md).

---

## 19. Custos

| Item | Custo Atual (Staging / MVP) | Custo Futuro Estimado (Produção) |
|---|---|---|
| Supabase Staging + Cloudflare Workers Free | **R$ 0,00** | Conforme plano escolhido pela DevEssent (recomenda-se Workers Paid `$5/mês` se tráfego/CPU escalar) |
| Simulador interno Sandbox e contratos 50/50 | **R$ 0,00** | **R$ 0,00** (controle administrativo nativo) |
| Cartão de Crédito Recorrente (Mercado Pago) | **R$ 0,00** (sandbox) | Tarifa MDR típica de mercado (~1,5% a 4,98% conforme tabela PJ vigente do provedor) |
| Pix Automático (futuro) | Não ativado | Tarifa fixa/percentual PJ reduzida conforme contrato com o provedor |

---

## 20. Testes Executados (Classificação Transparente por Camada)

| Camada de Teste | Status | Escopo Verificado |
|---|---|---|
| **1. Testes Unitários (`tests/unit/` incluindo `billing-domain-and-security.test.ts` e `mercado-pago-official-sandbox.test.ts`)** | **PASS (23/23 arquivos · 123/123 testes)** | Divisão 50/50 em inteiros, MRR, validação `/users/me` (`test_user`/`MLB`/`collector_id`) para `APP_USR-*` e `TEST-*`, seleção explícita `BILLING_PROVIDER_MODE`, segredo exclusivo sem fallback previsível ou reuso, endpoints `/preapproval` & `/authorized_payments`, `ts` em 10 e 13 dígitos, RBAC, magic bytes e indisponibilidade `503` |
| **2. Testes de Integração Real PostgreSQL/RLS (`billing-supabase-security.test.ts` + `retail-payments-supabase-staging.test.ts`)** | **PASS (2/2 suítes · 6/6 testes contra `auebnppzxcvtaaqqlbts`)** | Isolamento RLS entre `Ateliê` e `Verde`, bloqueio de `manager`/`staff` (0 linhas), bloqueio de UPDATE/RPC por `owner`, idempotência (`duplicate`), `past_due` com `tenants.status = active`, confirmação única 50/50 e ausência total de regressão no Retail Payments |
| **3. Homologação Online HTTPS em Cloudflare Workers Staging (`https://devessent-platform-staging.devessent.workers.dev`)** | **PASS (`0 pageErrors` · `0 HTTP 5xx` · `193/193 ok` no `wrangler tail`)** | Planos, assinaturas, marco de ativação, autorização pelo Owner, webhooks HMAC (`400` provider inválido, `401` assinatura forjada, `401` `live_mode=true`, `200 processed` `subscription_preapproval`, `200 processed` `paid`, `200 duplicate` replay, `200 ignored_out_of_order`, `past_due` com vitrine `/loja/atelie-demonstrativo` retornando `200 OK`, troca de cartão + regularização `active`, `providerOrigin` explícito), contrato 50/50 com upload privado (`receipt_attached` → `confirmed` → entrega → `completed`, leitura pública bloqueada `400`), cancelamento agendado, 13 registros de auditoria (11 ações distintas), bloqueio RBAC (`owner_verde`, `manager`, `staff`), Retail 100% intocado e limpeza integral ao final |
| **4. API Oficial Mercado Pago Sandbox (externa)** | **PENDENTE (credenciais `BILLING_MP_ACCESS_TOKEN` / `BILLING_MP_WEBHOOK_SECRET` da conta DevEssent ainda não provisionadas)** | Adaptador `official_sandbox_api` pronto (incluindo link de autorização externa no painel Owner e reconciliação de `subscription_preapproval`); homologação externa aguarda criação da aplicação Developers pelo proprietário da conta DevEssent |

---

## 21. Limitações Conhecidas do Sandbox

- Sem credenciais de teste da conta Mercado Pago da DevEssent configuradas nos secrets do Worker, a recorrência opera no **Simulador Interno Sandbox** com segredo HMAC exclusivo (`BILLING_WEBHOOK_SANDBOX_SECRET`), exercitando integralmente HMAC-SHA256, reconciliação PostgreSQL, idempotência, proteção fora de ordem e telas online, porém sem tráfego HTTP real para `api.mercadopago.com`.
- **Requisitos e limitações oficiais do Mercado Pago Sandbox (`/preapproval`):**
  - Uma credencial `TEST-...` **não basta sozinha** para homologar uma assinatura completa: é obrigatório criar duas **Contas de Teste** no painel Mercado Pago Developers (1 Vendedor/Collector DevEssent Sandbox + 1 Comprador/Payer Sandbox) e utilizar o e-mail `test_user_...@testuser.com` do comprador de teste como `payer_email` (e-mails reais ou `@devessent-demo.com` geram erro de ambiente misto).
  - O ambiente Sandbox do Mercado Pago não acelera ciclos mensais no relógio em tempo real (ciclos subsequentes dependem do Simulador de Webhooks do painel de desenvolvedores ou de `start_date` próximo).
  - A régua interna de retentativas do Mercado Pago (até 3 tentativas automáticas antes de cancelamento automático pelo gateway) não é customizável via API.
- Pix Automático permanece preparado estruturalmente (`pix_automatic_future`), sem ativação automática enquanto não houver homologação oficial na conta PJ do provedor.

---

## 22. Pendências para Produção

1. Criar a aplicação Mercado Pago Developers da **DevEssent** (com Contas de Teste Vendedor + Comprador), configurar `BILLING_MP_ACCESS_TOKEN` (`APP_USR-*` de Conta de Teste ou `TEST-*`), `BILLING_MP_WEBHOOK_SECRET`, `BILLING_MP_COLLECTOR_ID`, `BILLING_MP_ENVIRONMENT=sandbox` e `BILLING_PROVIDER_MODE=official_sandbox_api` via `wrangler versions secret put` no Worker `devessent-platform-staging` (sem jamais enviar chaves por chat), validar na Preview URL e homologar eventos externos reais `subscription_preapproval` e `subscription_authorized_payment` na URL `https://devessent-platform-staging.devessent.workers.dev/api/webhooks/billing/mercado_pago`.
2. Definir tabela definitiva de planos comerciais, termos jurídicos de contratação, política formal de tolerância/inadimplência e regras de cancelamento da DevEssent.
3. Configurar canal oficial de e-mail transacional (com consentimento e SPF/DKIM) para consumir `billing_notifications_queue` em produção.
4. Avaliar contratação do plano Cloudflare Workers Paid (`$5/mês`) para o ambiente de Produção caso o pico de CPU em páginas RSC concorrentes exija folga acima do plano Free.
5. Após homologação financeira completa em Staging, aprovar revisão/merge do PR `feat/saas-billing-subscriptions`, configurar ambiente e segredos de produção dedicados e somente então habilitar cobranças live de forma controlada.
6. Em fase futura separada, executar o onboarding financeiro individual dos estabelecimentos para o Fluxo A (Retail Payments).

---

## 23. Homologação Online em Staging — Fase 6E.2B

### 23.1 Estado do Deploy Controlado

- **Branch:** `feat/saas-billing-subscriptions`
- **Commit implantado:** `fcdda16` (`fcdda162d5d96b565d5031978534e0259a89471a`, ancestral direto de `2334f51` e `6ba6c41`)
- **Conta Cloudflare verificada:** `bf89f7f990af2c019abf8e7604db760d` (`devessent@outlook.com`, perfil `devessent`; conta EJC bloqueada *fail-closed*)
- **Worker:** `devessent-platform-staging` · **URL HTTPS:** `https://devessent-platform-staging.devessent.workers.dev`
- **Versão ativa:** `7c984c38-4e8d-4b9d-b093-889ab10222c4`
- **Ponto de rollback preservado (Fase 6E.1 · `6ba6c41`):** `9d82b763-dc9c-4308-b966-4ed72ba0a028` (`wrangler rollback 9d82b763-dc9c-4308-b966-4ed72ba0a028`)
- **Cloudflare Secrets configurados (apenas nomes):** `AUTH_BRIDGE_SECRET`, `BILLING_WEBHOOK_SANDBOX_SECRET`, `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### 23.2 Comparativo de Performance Online & Telemetria Cloudflare Workers

Medições executadas online em `https://devessent-platform-staging.devessent.workers.dev` em condições equivalentes (Playwright, 1 warm-up + 7 amostras full-reload `networkidle` + 6 transições SPA via sidebar + telemetria real `wrangler tail --format json` em 193 invocações):

| Rota | Reload Online 6E.1 (`6ba6c41`) p50 / p95 | Reload Online 6E.2B (`fcdda16`) p50 / p95 | Navegação SPA 6E.2B p50 / p95 | Edge `wrangler tail` CPU p50 / Wall p50 | Status |
|---|---|---|---|---|---|
| `/dashboard` | `869 ms` / `919 ms` | `898 ms` / `1091 ms` | `307 ms` / `348 ms` | `18 ms` / `103 ms` (`22/22 ok`) | Sem regressão |
| `/dashboard/retail` | `847 ms` / `901 ms` | `836 ms` / `919 ms` | `262 ms` / `319 ms` | `23 ms` / `98 ms` (`6/6 ok`) | Sem regressão |
| `/dashboard/assinatura` | *(nova)* | `826 ms` / `908 ms` | `247 ms` / `268 ms` | `30 ms` / `122 ms` (`15/15 ok`) | Ótima (prefetch paralelo RLS) |
| `/admin/comercial` | *(nova)* | `846 ms` / `978 ms` | `383 ms` / `513 ms` | `29 ms` / `139 ms` (`24/24 ok`) | Ótima |
| `/api/webhooks/billing/mercado_pago` | *(nova)* | — | — | `14 ms` / `120 ms` (`16/16 ok`) | Ótima |

- **Telemetria Global (`wrangler tail`):** `193/193` invocações com `outcome: "ok"`, **`0` exceções**, **`0` `exceededCpu`**, **`0` `exceededMemory`**, CPU global p50 `15 ms` / p95 `77 ms`, Wall Time global p50 `64 ms` / p95 `351 ms`, startup `16 ms`, upload gzip `663,42 KiB`.

### 23.3 Guia Manual para Ativação das Credenciais Oficiais Mercado Pago Sandbox

> **Regra de sigilo:** jamais envie tokens, chaves ou senhas por mensagens de chat ou commits Git. Configure os segredos diretamente no terminal local autenticado com o perfil `devessent`.

1. **Acessar o Portal Mercado Pago Developers (conta da DevEssent):** entre em `https://www.mercadopago.com.br/developers/panel/app` com a conta oficial da DevEssent e clique em **Criar aplicação** (tipo *Pagamentos online* / *Checkout API e Assinaturas*, nome sugerido `DevEssent Platform Billing Staging`).
2. **Criar duas Contas de Teste (*Suas integrações → Contas de teste*):**
   - **Conta Vendedor de Teste (Collector — DevEssent Sandbox):** anote o e-mail/senha de teste; acesse o painel Developers com essa conta de teste (ou utilize as *Credenciais de teste* da aplicação) para obter o **Access Token de Teste (`TEST-...`)**.
   - **Conta Comprador de Teste (Payer — Lojista Sandbox):** anote o e-mail `test_user_...@testuser.com` e senha. Esse e-mail deverá ser usado no fluxo de consentimento do `init_point` com os cartões de teste oficiais do Mercado Pago.
3. **Configurar o Webhook oficial em Modo Teste (*Webhooks → Configurar notificações → Modo de teste*):**
   - **URL de teste:** `https://devessent-platform-staging.devessent.workers.dev/api/webhooks/billing/mercado_pago`
   - **Eventos selecionados:** marcar **Planos e assinaturas** (`subscription_preapproval` e `subscription_authorized_payment`).
   - Salvar e copiar a **Assinatura secreta** gerada pelo Mercado Pago para o ambiente de teste.
4. **Configurar os Secrets em Versão Não-Ativa no Worker de Staging (PowerShell local, conta DevEssent):**
   ```powershell
   $env:CLOUDFLARE_ACCOUNT_ID = "bf89f7f990af2c019abf8e7604db760d"
   npx wrangler versions secret put BILLING_MP_ACCESS_TOKEN --name devessent-platform-staging
   npx wrangler versions secret put BILLING_MP_WEBHOOK_SECRET --name devessent-platform-staging
   npx wrangler versions secret put BILLING_MP_COLLECTOR_ID --name devessent-platform-staging
   npx wrangler versions secret put BILLING_MP_ENVIRONMENT --name devessent-platform-staging    # valor: sandbox
   npx wrangler versions secret put BILLING_PROVIDER_MODE --name devessent-platform-staging     # valor: official_sandbox_api
   # Validar via Preview URL (botão "Diagnosticar Provedor MP") e então promover:
   npx wrangler versions deploy --name devessent-platform-staging
   ```
5. **Validação imediata após configurar os secrets:**
   - Acesse `https://devessent-platform-staging.devessent.workers.dev/admin/comercial` e confirme que o selo do provedor mudou automaticamente para **`Mercado Pago Assinaturas (API Sandbox)`** (desabilitando automaticamente os botões do simulador interno).
   - Vincule uma empresa demonstrativa a um plano de teste, abra o link **`Autorizar no Mercado Pago (Sandbox)`** em `/dashboard/assinatura` logado na Conta Comprador de Teste, conclua o consentimento com cartão de teste do Mercado Pago e acompanhe a chegada real dos webhooks `subscription_preapproval` e `subscription_authorized_payment` com `providerOrigin = "mercado_pago_official_sandbox"`.
