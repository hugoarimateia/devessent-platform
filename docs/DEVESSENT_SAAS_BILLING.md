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

**Transparência operacional:** quando `BILLING_MP_ACCESS_TOKEN` (prefixo `TEST-...`) e `BILLING_MP_WEBHOOK_SECRET` da conta DevEssent não estão configurados no servidor, o adaptador sinaliza explicitamente na UI e nos logs o modo **`internal_sandbox_simulator`**. Credenciais de produção (`APP_USR-*`) são bloqueadas *fail-closed*.

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

- **Segredos isolados no servidor:** `BILLING_MP_ACCESS_TOKEN` e `BILLING_MP_WEBHOOK_SECRET` são exclusivamente segredos de runtime (nunca enviados ao navegador nem versionados no Git).
- **Zero impacto nas demais páginas da plataforma:** `resolveWorkspaceSession()` permanece intocado — nenhuma consulta Billing é executada em `/dashboard`, `/dashboard/retail/**`, `/loja/**` ou `/admin`.
- **Pré-busca paralela RLS-enforced:** `/dashboard/assinatura` utiliza `getActiveTenantHintUuid()` em paralelo com `resolveWorkspaceSession()`, preservando as otimizações das Fases 6D.2 e 6E.1.
- **Impacto de bundle Workers (`vinext`):** `+0,16 MiB` descomprimido (`2,44 → 2,60 MiB`, `4,1%` do limite de `64 MiB`) e `+0,04 MiB` gzip-9 (`0,72 → 0,76 MiB`).

---

## 19. Custos

| Item | Custo Atual (Staging / MVP) | Custo Futuro Estimado (Produção) |
|---|---|---|
| Supabase Staging + Cloudflare Workers Free | **R$ 0,00** | Conforme plano escolhido pela DevEssent |
| Simulador interno Sandbox e contratos 50/50 | **R$ 0,00** | **R$ 0,00** (controle administrativo nativo) |
| Cartão de Crédito Recorrente (Mercado Pago) | **R$ 0,00** (sandbox) | Tarifa MDR típica de mercado (~1,5% a 4,98% conforme tabela PJ vigente do provedor) |
| Pix Automático (futuro) | Não ativado | Tarifa fixa/percentual PJ reduzida conforme contrato com o provedor |

---

## 20. Testes Executados (Classificação Transparente por Camada)

| Camada de Teste | Status | Escopo Verificado |
|---|---|---|
| **1. Testes Unitários (`tests/unit/billing/billing-domain-and-security.test.ts` + suíte completa)** | **PASS (22/22 arquivos · 119/119 testes)** | Divisão 50/50 em inteiros (inclusive valores ímpares), MRR, bloqueio fail-closed `APP_USR-`/live, prontidão de início agendado, matriz RBAC, magic bytes de comprovante PDF/PNG e HMAC-SHA256 |
| **2. Testes de Integração Real PostgreSQL/RLS (`tests/integration/billing-supabase-security.test.ts`)** | **PASS (2/2 contra `auebnppzxcvtaaqqlbts`)** | Isolamento RLS entre `Ateliê` e `Verde`, bloqueio de `manager`/`staff` (0 linhas), bloqueio de UPDATE direto por `owner`, bloqueio de RPC por `owner`, idempotência de webhook (`duplicate`), inadimplência `past_due` com `tenants.status = active`, confirmação única 50/50 |
| **3. Testes E2E + Webhooks + Storage em Runtime Cloudflare Workers local (`workerd` / `pnpm cf:preview:staging`)** | **PASS (0 pageErrors · 0 HTTP 5xx)** | Criação de planos via UI, proteção de preço em assinaturas existentes, vinculação de empresa, autorização pelo Owner em `/dashboard/assinatura`, confirmação de ativação, webhook inválido (`401`), `live_mode: true` (`401`), webhook pago (`200 processed`), webhook repetido (`200 duplicate`), atraso sem suspender vitrine (`200`), atualização de cartão + regularização (`active`), contrato 50/50 com upload de PDF real em `billing-receipts` (`receipt_attached` → `confirmed`), entrega, bloqueio RBAC de `owner` em `/admin/comercial` e `manager` em `/dashboard/assinatura` |
| **4. Cloudflare Workers Staging remoto (`devessent-platform-staging`)** | **Build & Bundle verificados (`2,60 MiB` / `0,76 MiB` gzip); deploy controlado aguardando revisão da branch `feat/saas-billing-subscriptions`** | Mantido o Staging remoto estável em `6ba6c41` conforme regra de deploy controlado (§15) |
| **5. API Oficial Mercado Pago Sandbox (externa)** | **PENDENTE (credenciais `BILLING_MP_ACCESS_TOKEN` / `BILLING_MP_WEBHOOK_SECRET` da conta DevEssent não configuradas)** | Adaptador pronto; homologação externa marcada explicitamente como pendente até provisionamento das credenciais de teste da conta DevEssent |

---

## 21. Limitações Conhecidas do Sandbox

- Sem credenciais de teste da conta Mercado Pago da DevEssent configuradas em secrets, a recorrência opera no **Simulador Interno Sandbox** (exercitando integralmente HMAC-SHA256, RPCs PostgreSQL, idempotência e telas, porém sem tráfego HTTP real para `api.mercadopago.com`).
- Mesmo com credenciais Sandbox oficiais do Mercado Pago, o ambiente Sandbox do provedor utiliza cartões de teste específicos e não reproduz integralmente regras antifraude nem cobranças agendadas em tempo real de 30 dias (usando simulador de webhooks do painel de desenvolvedores).
- Pix Automático permanece preparado estruturalmente (`pix_automatic_future`), sem ativação automática enquanto não houver homologação oficial na conta PJ do provedor.

---

## 22. Pendências para Produção

1. Provisionar credenciais Sandbox oficiais da conta **DevEssent** no Mercado Pago (`BILLING_MP_ACCESS_TOKEN=TEST-...` e `BILLING_MP_WEBHOOK_SECRET`) e homologar eventos reais `subscription_preapproval` e `subscription_authorized_payment` apontando para `https://devessent-platform-staging.devessent.workers.dev/api/webhooks/billing/mercado_pago`.
2. Definir tabela definitiva de planos comerciais, termos jurídicos de contratação, política formal de tolerância/inadimplência e regras de cancelamento da DevEssent.
3. Configurar canal oficial de e-mail transacional (com consentimento e SPF/DKIM) para consumir `billing_notifications_queue` em produção.
4. Após homologação financeira completa em Staging, habilitar o deploy da branch `feat/saas-billing-subscriptions`, configurar segredos de produção em conta/Worker dedicado e somente então liberar a flag explícita de cobrança real.
5. Em fase futura separada, executar o onboarding financeiro individual dos estabelecimentos para o Fluxo A (Retail Payments).
