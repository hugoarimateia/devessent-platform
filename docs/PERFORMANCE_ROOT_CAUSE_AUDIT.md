# Auditoria de Causa Raiz e Otimização de Performance — DevEssent Platform (Fase 6D.2)

- **Data:** 20/11/2026
- **Branch:** `fix/dashboard-navigation-performance` (a partir de `main` @ `4af80c1`)
- **Ambiente Oficial Auditado:** Supabase Cloud Staging — Projeto `dev-essent.stagging` (`auebnppzxcvtaaqqlbts`), organização `DevEssent`, região `sa-east-1` (São Paulo), PostgreSQL `17.11.0.019`, plano Free.
- **Escopo:** Diagnóstico empírico de causa raiz e eliminação de gargalos na navegação entre páginas e abas do painel administrativo (`/dashboard/**` e `/admin/**`), sem enfraquecer RLS, FORCE RLS, RBAC, Auth ou isolamento multiempresa.

---

## 1. Resumo Executivo

A investigação empírica ponta a ponta comprovou que o atraso anormal na navegação do painel administrativo (`1.616–2.258 ms` p50 em `pnpm dev:staging` e `954–1.180 ms` p50 mesmo em build otimizado `next start`) **não era causado por lentidão de consultas SQL no PostgreSQL** (todas executavam entre `0,09 ms` e `4,98 ms` segundo `EXPLAIN (ANALYZE, BUFFERS)`), nem apenas pelo modo dev.

A causa raiz primária (P0) era uma **cascata de 8 a 9 roundtrips HTTPS sequenciais** ao Supabase Cloud (`~80–105 ms` por RTT) executados do zero em **cada clique de aba**, somada à **remontagem integral do `<AppShell>` (`10/10` cliques)** por ausência de `layout.tsx`, **imports monolíticos via barrel `@/modules/retail`** (carregando `178 kB` de JS e o adaptador MariaDB/XAMPP de 1.380 linhas em rotas Supabase), **overfetching** no `/dashboard`, e uma **tempestade de 5 a 7 prefetches RSC concorrentes** disparada por `<Link>` em linhas de tabelas saturando o limite de 6 sockets HTTP/1.1 do navegador.

Após a correção arquitetural na causa raiz:

- **Build otimizado (`pnpm build:staging` + `pnpm start:staging`):**
  - Navegação aquecida entre todas as 5 rotas principais caiu de **`954–1.180 ms` p50** para **`321–474 ms` p50** (**redução de 59,8% a 68,7% — 2,5x a 3,2x mais rápido**), medida até a renderização de **dados reais visíveis** e dois frames de pintura (`requestAnimationFrame`), sem uso de skeletons para mascarar tempo.
  - Percentil **p95** caiu para **`402–996 ms`** (todas as rotas abaixo de 1.000 ms).
  - Tempo de resposta RSC no servidor caiu de **`812–1.048 ms`** para **`194–295 ms`** (**-71,9% a -76,1%**), atingindo o piso físico da arquitetura (2 RTTs HTTPS contra `sa-east-1`).
  - Feedback visual imediato no clique (`useLinkStatus` nativo do Next.js 15) caiu de **`907–1.133 ms`** para **`72–102 ms`**.
  - Remontagens de `<AppShell>` (`Sidebar`/`Topbar`): **`10/10` → `0/10`**.
  - `First Load JS` das rotas Retail e Admin Sites caiu de **`178 kB`** para **`109–118 kB`** (**-60 a -69 kB**, redução de ~35–39%).
- **Desenvolvimento (`pnpm dev:staging`, Webpack):**
  - Compilação fria (1ª visita) caiu de **`2.731–18.000 ms`** para **`1.165–7.158 ms`** (até **-73,6%** em Pedidos).
  - Navegação aquecida caiu de **`1.616–2.258 ms` p50** para **`650–983 ms` p50** (**-56,5% a -60,9%**), com p95 caindo de **`2.025–4.995 ms`** para **`739–1.382 ms`** (**-47,3% a -78,8%**).
- **Segurança e regressões:** 100% preservadas — `29/29` suítes Vitest (`195/195` testes, incluindo `86` testes reais PostgreSQL/RLS/RBAC/Pagamentos no Staging), `5/5` jornadas E2E Playwright (Owner, Multi-Tenant Switch, Staff RBAC 403, Platform Admin, Storefront Público, Dark/Light, Mobile, Back Navigation), `0` erros de console e dados demonstrativos permanentes intactos.

---

## 2. Sintoma Original Relatado e Comparação com o `SITE EJC`

O usuário relatou atraso perceptível ao alternar entre páginas, abas e seções do painel administrativo da DevEssent Platform mesmo após a migração para o Supabase Cloud Staging em `sa-east-1`, em contraste com a fluidez percebida no projeto anterior `SITE EJC`.

Uma inspeção somente leitura em `D:\Documentos\Projetos\SITE EJC` (nenhum arquivo alterado) explicou objetivamente a diferença de arquitetura:

| Dimensão | `SITE EJC` | DevEssent Platform (Antes) | DevEssent Platform (Depois) |
|---|---|---|---|
| Arquitetura | HTML/CSS/JS estático puro (`serve -l 3000 .` + Cloudflare Pages) | Next.js 15 App Router SSR dinâmico sem `layout.tsx` de dashboard | Next.js 15 App Router com `layout.tsx` persistente + 2 RTTs paralelos |
| Autenticação por clique | Sem SSR/Middleware a cada clique | 2× `getUser()` + 5–7 queries sequenciais por clique | 1× `getUser()` (Middleware) + ponte HMAC-SHA256 + 1 RTT paralelo |
| Bundler em dev local | Zero compilação (arquivos estáticos) | Webpack compilando barrel `@/modules/retail` + XAMPP em HDD 5400 RPM | Imports diretos por submódulo + XAMPP carregado dinamicamente |
| Shell de navegação | Estático na página | Remontado integralmente (`10/10`) em cada rota | Persistente em `dashboard/layout.tsx` e `admin/layout.tsx` (`0/10`) |

---

## 3. Metodologia de Medição

Para garantir rigor científico e impedir conclusões superficiais ou mascaramento de latência:

1. **Ambiente controlado e repetível:** Harness automatizado em Playwright (`chromium` headless, viewport `1440x900`) autenticando com conta real (`owner.atelie@devessent-demo.com`) no Supabase Cloud Staging (`auebnppzxcvtaaqqlbts.supabase.co`).
2. **Critério rigoroso de término ("click-to-real-data"):** O cronômetro inicia em `tClick` (antes de clicar no link da `Sidebar`) e só encerra quando:
   - `window.location.pathname` corresponde à rota de destino;
   - Um texto de **dado real de negócio vindo do PostgreSQL** está visível no DOM (`Blazer Estruturado Linho Cru`, `Alfaiataria`, `ATD-DEMO-0001`, `ATD-DEMO-0002`, `Produtos Publicados`);
   - Dois frames consecutivos de renderização (`2 × requestAnimationFrame`) foram pintados.
   - **Nunca** se considera skeleton ou loading state como conclusão da navegação.
3. **Amostragem estatística:**
   - **Medição de RTT direto ao Supabase Cloud (`sa-east-1`):** 6 amostras de `auth.getUser()` e 6 de REST `tenants` (descartando a 1ª de handshake TLS para RTT em regime estacionário).
   - **Pass 0 (Cold / 1ª visita)** em cada uma das 5 rotas principais.
   - **10 ciclos aquecidos consecutivos** (50 cliques principais por cenário) reportando `min`, `p50`, `p95`, `max`, `feedbackP50`, `rscP50`, `clientP50`, bytes do payload RSC e taxa de remontagem do `<aside>` (via tag de identidade no nó DOM real).
   - **Rotas secundárias** (`Membros`, `Configurações`, `Painel Retail`, `Atividades`, retorno ao `Dashboard`): 1 passagem fria + 2 aquecidas.
4. **Perfilamento de banco e servidor:**
   - `EXPLAIN (ANALYZE, BUFFERS)` direto no PostgreSQL `17.11` via Supabase Management API nas 3 consultas críticas.
   - Instrumentação opcional por variável `DEVESSENT_PERF_TRACE=1` (`src/lib/perf/perf-trace.ts`, no-op por padrão, zero segredos/PII nos logs) para medir spans internos de Middleware, Auth Bridge e Workspace Bootstrap.

---

## 4. Diferença Entre `next dev` (Webpack vs Turbopack) e Build Otimizado (`next start`)

Foram executados **5 benchmarks completos** (10 ciclos aquecidos cada):

1. **BEFORE `pnpm dev:staging` (Webpack):** Média p50 `1.616–2.258 ms`; cold `2.731–18.000 ms`.
2. **BEFORE `pnpm build:staging` + `pnpm start:staging`:** Média p50 `954–1.180 ms`; cold `1.057–1.308 ms`.
   - *Prova empírica fundamental:* Mesmo eliminando 100% do overhead do `next dev`, o build otimizado ainda levava **`~1,0 segundo` por clique**, provando que **~750–900 ms** do atraso eram **causa arquitetural no código da aplicação (cascata de RTTs)**, e outros **~650–1.080 ms** adicionais em `dev` eram overhead do bundler dev em disco mecânico HDD + pressão de RAM.
3. **AFTER `pnpm build:staging` + `pnpm start:staging`:** Média p50 **`321–474 ms`** (`rscP50 = 194–295 ms`, `p95 = 402–996 ms`).
4. **AFTER `pnpm dev:staging` (Webpack):** Média p50 **`650–983 ms`** (`p95 = 739–1.382 ms`, cold `1.165–7.158 ms`).
5. **AFTER `next dev --turbopack` (teste isolado §9):**
   - Cold compile mais rápido (`2.337–3.329 ms` vs `2.880–7.158 ms` do Webpack; `Login -> Dashboard` `6.130 ms` vs `11.917 ms`), com `0` erros de console.
   - **Porém, na navegação aquecida (10 ciclos), o Turbopack foi 25% a 53% MAIS LENTO que o Webpack** neste hardware (`855–1.318 ms` p50 vs `650–983 ms` p50 do Webpack; `rscP50` de `640–1.124 ms` vs `477–807 ms` e payloads dev maiores: `180 KB` vs `152 KB` no Dashboard), devido à revalidação de grafo do Rust dev server no HDD 5400 RPM sob pressão de swap.
   - **Decisão baseada em dados:** Manter `pnpm dev:staging` em Webpack (mais rápido no uso contínuo após aquecimento e 100% estável) e recomendar `pnpm build:staging && pnpm start:staging` sempre que se desejar validar a fluidez real equivalente à produção.

---

## 5. Métricas Coletadas

### 5.1 RTT Direto ao Supabase Cloud (`sa-east-1`) e Tempo de Execução SQL

| Métrica de Infraestrutura | Valor Medido |
|---|---|
| `auth.getUser()` RTT direto (regime estacionário p50) | `68 – 101 ms` (min `54 ms`, max `114 ms`) |
| PostgREST query simples RTT direto (regime estacionário p50) | `66 – 112 ms` (min `58 ms`, max `156 ms`) |
| `EXPLAIN (ANALYZE, BUFFERS)` — `retail_orders` listing | **0,091 ms** execução (`0,634 ms` planning) |
| `EXPLAIN (ANALYZE, BUFFERS)` — `retail_products` + `retail_variants` | **4,977 ms** execução (`1,652 ms` planning) |
| `EXPLAIN (ANALYZE, BUFFERS)` — `tenant_memberships + tenants + tenant_settings` | **4,737 ms** execução (`1,173 ms` planning) |

**Conclusão SQL:** O banco PostgreSQL responde em **< 5 ms** por consulta. O custo dominante de rede é o **número de roundtrips sequenciais** (`N × ~80–100 ms`), não o tempo de execução no banco.

### 5.2 Spans Internos de Servidor (`DEVESSENT_PERF_TRACE=1` após otimização)

Amostras reais registradas no servidor `pnpm start:staging` durante a suíte E2E:

```text
[PERF][middleware] supabase.auth.getUser=68.7ms path=/dashboard/retail/categorias authenticated=true
[PERF][auth] resolveVerifiedAuthUser.bridgeHit=9.6ms
[PERF][workspace] singleRttBootstrap=81.3ms
[PERF][workspace] totalResolve=92.4ms hasStore=true

[PERF][middleware] supabase.auth.getUser=90.7ms path=/dashboard/retail/pedidos authenticated=true
[PERF][auth] resolveVerifiedAuthUser.bridgeHit=12.2ms
[PERF][workspace] singleRttBootstrap=84.9ms
[PERF][workspace] totalResolve=99.5ms hasStore=true

[PERF][middleware] supabase.auth.getUser=84.7ms path=/dashboard/retail/pagamentos authenticated=true
[PERF][auth] resolveVerifiedAuthUser.bridgeHit=11.6ms
[PERF][workspace] singleRttBootstrap=79.7ms
[PERF][workspace] totalResolve=94.2ms hasStore=true
```

### 5.3 Redução de Bundle (`First Load JS` no `next build`)

| Rota | ANTES (`First Load JS`) | DEPOIS (`First Load JS`) | Redução |
|---|---:|---:|---:|
| `/dashboard/retail/categorias` | `178 kB` | **`109 kB`** | **-69 kB (-38,8%)** |
| `/dashboard/retail/configuracoes` | `178 kB` | **`111 kB`** | **-67 kB (-37,6%)** |
| `/admin/sites` | `178 kB` | **`112 kB`** | **-66 kB (-37,1%)** |
| `/dashboard/retail/produtos` | `178 kB` | **`113 kB`** | **-65 kB (-36,5%)** |
| `/dashboard/retail` | `178 kB` | **`116 kB`** | **-62 kB (-34,8%)** |
| `/dashboard/retail/produtos/[id]` | `178 kB` | **`116 kB`** | **-62 kB (-34,8%)** |
| `/dashboard/retail/pagamentos` | `178 kB` | **`117 kB`** | **-61 kB (-34,3%)** |
| `/dashboard/retail/pedidos` | `178 kB` | **`118 kB`** | **-60 kB (-33,7%)** |

---

## 6. Causas Raiz Identificadas (Classificadas por Impacto)

### RC-1 (P0 — Crítica, +600 a +900 ms por clique em Dev e Prod): Cascata de 8–9 Roundtrips Sequenciais ao Supabase
A cada navegação interna no dashboard, o servidor executava sequencialmente:
1. `middleware.ts`: `supabase.auth.getUser()` (~80–100 ms);
2. `page.tsx`: `AuthService.getSessionUser()` chamando **`supabase.auth.getUser()` uma 2ª vez** (~80–100 ms) + `profiles`/`platform_admins` (~80–100 ms);
3. `TenantService.listUserTenants()` (~80–100 ms);
4. `TenantService.resolveTenantContext()` reconsultando `platform_admins` + `tenants` (~80–100 ms);
5. `TenantService.resolveTenantContext()` reconsultando `tenant_memberships` (~80–100 ms);
6. `RetailStoreService.getStore()` (~80–100 ms);
7. Consultas da página (e em `Pedidos`, `listOrders` ainda disparava 2 queries sequenciais `retail_orders` → `retail_order_items`; em `/dashboard`, `AuditService.listTenantAuditLogs` re-executava `TenantService.resolveTenantContext()` + `audit_logs` + `profiles` + `platform_admins` = 4–5 RTTs extras!).

### RC-2 (P0 — Crítica, `shellRemount=10/10`, `feedbackP50=907–2.226 ms`): Ausência de `layout.tsx` Persistente e Zero Feedback de Clique
Todas as 14 páginas de `/dashboard/**` e 5 páginas de `/admin/**` renderizavam `<AppShell>` diretamente dentro de `page.tsx`. Cada transição desmontava e remontava `Sidebar`, `Topbar`, `TenantSelector`, `UserMenu` e `MobileNavigation`. Sem feedback pendente de link, o usuário clicava e a interface ficava visualmente congelada por `0,9–2,2 s`.

### RC-3 (P0 — Crítica, descoberta durante validação): Tempestade de Prefetches RSC em Tabelas e Cards
Embora a `Sidebar` usasse `prefetch={false}`, dezenas de `<Link>` em `retail-product-table.tsx`, `retail-orders-table.tsx`, `retail-payments-table.tsx`, `retail-dashboard.tsx`, `dashboard-banner.tsx` e `dashboard/page.tsx` não possuíam `prefetch={false}`. Ao abrir `Produtos` ou `Pedidos`, o Next.js disparava automaticamente **5 a 7 requisições `?_rsc=` simultâneas** para rotas de detalhe, cada uma batendo no `getUser()` do Middleware e saturando o pool de 6 conexões HTTP/1.1 do navegador justamente quando o usuário clicava na aba seguinte.

### RC-4 (P1 — Alta, +650 a +1.080 ms em Dev + `178 kB` First Load JS): Barrel `@/modules/retail` e Imports Estáticos do Adaptador XAMPP/MariaDB
Todas as páginas Retail e `/admin/sites` importavam do barrel monolítico `@/modules/retail` (que re-exportava 9 subdiretórios completos). Além disso, `retail-order-service.ts` e `retail-payment-service.ts` importavam estaticamente `XamppRetailOrderAdapter` e `XamppRetailPaymentAdapter` (1.380 linhas + `mysql2/promise`), obrigando o Webpack a compilar e analisar código MariaDB em rotas exclusivas de Supabase no HDD 5400 RPM.

### RC-5 (P1 — Alta): Overfetching no `/dashboard`, `getPaymentStats` e N+1 em `/admin/sites`
- `RetailProductService.getDashboardSummary()` executava `SELECT *, retail_variants(*), retail_product_images(*), retail_product_options(*), retail_product_categories(retail_categories(*))` para até 100 produtos apenas para calcular contadores inteiros (e `recentProducts` sequer era lido por `dashboard/page.tsx`).
- `RetailPaymentService.getPaymentStats()` executava `SELECT *` em até 500 pagamentos quando `computeStatsFromPayments` só necessita de 6 colunas.
- `src/app/(platform)/admin/sites/page.tsx` executava um loop `for (const s of stores) { await RetailPaymentService.getConnectionSummary(...) }` (N+1 sequencial).

### RC-6 (Descoberta de Engenharia — Deadlock de `loading.tsx` em Rotas Irmãs no Next.js 15.5.29)
Durante os testes empíricos com `src/app/(tenant)/dashboard/loading.tsx`, identificou-se que a combinação de `loading.tsx` no segmento pai (`dashboard`) + navegação rápida entre rotas irmãs sob subsegmento sem `loading.tsx` (`/dashboard/retail/categorias` → `/dashboard/retail/pedidos` → `/dashboard/retail/pagamentos`) com `<Link prefetch={false}>` acionava uma condição de corrida do roteador cliente do Next.js 15.5.29 em que a resposta RSC `200 OK` e os chunks JS completavam mas a transição ficava presa com `useLinkStatus().pending === true`. A remoção do `loading.tsx` de segmento pai aliada ao indicador nativo `useLinkStatus()` eliminou **100% dos travamentos** (60/60 cliques consecutivos concluídos sem nenhuma falha) mantendo feedback visual imediato (< 100 ms) sem destruir o conteúdo atual durante os ~200–350 ms de transição.

---

## 7. Evidências Técnicas e Arquivos Responsáveis

| Causa Raiz | Arquivos Originais Envolvidos |
|---|---|
| RC-1 (Auth duplicado + bootstrap 6-RTT + Audit 4-RTT + Orders 2-RTT) | `src/lib/supabase/middleware.ts`, `src/core/auth/services/auth-service.ts`, `src/core/audit/services/audit-service.ts`, `src/modules/retail/services/retail-order-service.ts`, `src/app/(tenant)/dashboard/**/page.tsx` (14 páginas), `src/app/(platform)/admin/**/page.tsx` (5 páginas) |
| RC-2 (Remontagem de `<AppShell>` + ausência de feedback pendente) | Ausência de `src/app/(tenant)/dashboard/layout.tsx`, `src/app/(platform)/admin/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/mobile-navigation.tsx` |
| RC-3 (Prefetch storm em tabelas/banners) | `src/modules/retail/components/retail-product-table.tsx`, `retail-orders-table.tsx`, `retail-payments-table.tsx`, `retail-dashboard.tsx`, `src/components/dashboard/dashboard-banner.tsx`, `dashboard-charts.tsx`, `src/app/(tenant)/dashboard/page.tsx`, `pedidos/page.tsx`, `pagamentos/page.tsx` |
| RC-4 (Barrel `@/modules/retail` + imports estáticos XAMPP) | `src/modules/retail/services/retail-order-service.ts`, `src/modules/retail/services/retail-payment-service.ts`, `src/infrastructure/xampp-test/retail-payment-adapter.ts`, todas as páginas Retail e `admin/sites/page.tsx` |
| RC-5 (Overfetching + N+1) | `src/modules/retail/services/retail-product-service.ts` (`getDashboardSummary`), `src/modules/retail/services/retail-payment-service.ts` (`getPaymentStats`), `src/app/(platform)/admin/sites/page.tsx`, `src/app/(tenant)/dashboard/retail/produtos/[id]/page.tsx` |

---

## 8. Correções Implementadas

1. **Ponte Criptográfica Interna Middleware → RSC (`src/lib/supabase/auth-bridge.ts`, `src/lib/supabase/middleware.ts`, `src/core/auth/services/auth-service.ts`):**
   - O Middleware remove incondicionalmente qualquer `x-devessent-mw-auth` vindo do cliente, executa `supabase.auth.getUser()` autoritativamente **uma única vez**, e anexa um header assinado via **Web Crypto HMAC-SHA256** com TTL de 10 s e fingerprint SHA-256 dos cookies Supabase ativos.
   - `AuthService.resolveVerifiedAuthUser()` valida assinatura em tempo constante + TTL + fingerprint de cookie (`0` RTT extra); qualquer divergência ou chamada fora do Middleware (Server Actions, testes, APIs) faz fallback automático para `supabase.auth.getUser()`.
2. **Bootstrap Consolidado e Memoizado (`src/lib/workspace/workspace-context.ts`):**
   - `resolveWorkspaceSession()` (envolvido em `React.cache`) busca `profiles`, `platform_admins` e `tenant_memberships(tenants(tenant_settings, retail_stores))` em **1 único RTT paralelo protegido por RLS + FORCE RLS**, preservando o fallback de tenant suspenso e o isolamento do modo XAMPP.
   - `resolveSessionUserCached()` elimina consultas duplicadas entre `admin/layout.tsx` e páginas `/admin/**`.
   - **Paralelização Segura por Cookie Hint UUID (`getActiveTenantHintUuid` + `buildSpeculativeRlsTenantContext`):** Em modo Supabase (onde RLS + FORCE RLS bloqueiam acesso indevido no motor do PostgreSQL), páginas disparam o bootstrap do workspace e as leituras RLS da página no mesmo `Promise.all`; o resultado só é reutilizado após validar sessão, suspensão, RBAC explícito (`redirect("/forbidden")`) e igualdade exata `activeContext.tenantId === hintTenantId`. Em modo XAMPP o caminho especulativo é desabilitado.
   - `loginAction` pré-grava o UUID canônico do primeiro tenant no cookie de sessão; `switchTenantAction` grava o UUID canônico e executa `revalidatePath("/dashboard", "layout")`; `logoutAction` limpa o cookie e executa `revalidatePath("/", "layout")`.
3. **Layouts Persistentes e Feedback Nativo (`dashboard/layout.tsx`, `admin/layout.tsx`, `sidebar.tsx`, `mobile-navigation.tsx`):**
   - `<AppShell>` movido para `src/app/(tenant)/dashboard/layout.tsx` e `src/app/(platform)/admin/layout.tsx` e removido das 19 páginas filhas (`0/10` remontagens).
   - Feedback instantâneo de clique via `useLinkStatus()` oficial do Next.js 15 (`data-nav-pending="true"` + indicador visual sutil).
4. **Eliminação de Queries Redundantes, Overfetching, N+1 e Barrel Imports:**
   - `RetailOrderService.listOrders()`: 2 queries sequenciais consolidadas em **1 query** `.select("*, retail_order_items(quantity)", { count: "exact" })` (com FK declarada em `src/types/database.types.ts`).
   - `AuditService.listTenantAuditLogs()`: aceita `preResolvedContext` (elimina 2 RTTs duplicados) e faz JOIN `profiles(full_name)` embutido (elimina +1 RTT).
   - `RetailProductService.getDashboardSummary()`: projeção mínima (`id, status, retail_variants(stock_quantity), retail_product_categories(category_id)` e `retail_categories(id, name, is_active)`).
   - `RetailPaymentService.getPaymentStats()`: projeção mínima de 6 colunas e extração da função pura `computeStatsFromPayments` para `src/modules/retail/domain/payment-invariants.ts`.
   - Adaptadores XAMPP convertidos para `await import(...)` dinâmico dentro de guards `NODE_ENV !== "production" && isXamppTestMode()`.
   - Imports diretos por submódulo em todas as páginas do Dashboard e Admin (zero barrel `@/modules/retail`).
   - Loop N+1 de `/admin/sites/page.tsx` convertido para `Promise.all`.
   - `prefetch={false}` aplicado em links de tabelas/banners/cards para eliminar tempestades de prefetch concorrente.
5. **Instrumentação de Telemetria Controlada (`src/lib/perf/perf-trace.ts`):**
   - Ativável apenas via `DEVESSENT_PERF_TRACE=1`, totalmente inerte em operação normal e livre de dados sensíveis.

---

## 9. Tabela Comparativa — ANTES vs DEPOIS (10 Ciclos Aquecidos + Cold)

### 9.1 Cenário B — Build Otimizado (`pnpm build:staging` + `pnpm start:staging`)

| Transição | Cold ANTES | Cold DEPOIS | p50 ANTES | **p50 DEPOIS** | Ganho p50 | p95 ANTES | **p95 DEPOIS** | Feedback p50 (A→D) | RSC p50 (A→D) | Shell Remount |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Dashboard → Produtos** | 1.308 ms | **578 ms** | 969 ms | **324 ms** | **-66,6% (3,0x)** | 1.125 ms | **613 ms** | 922 → **102 ms** | 812 → **194 ms** | 10/10 → **0/10** |
| **Produtos → Categorias** | 1.057 ms | **416 ms** | 954 ms | **321 ms** | **-66,4% (3,0x)** | 1.025 ms | **402 ms** | 907 → **72 ms** | 823 → **200 ms** | 10/10 → **0/10** |
| **Categorias → Pedidos** | 1.222 ms | **530 ms** | 1.065 ms | **333 ms** | **-68,7% (3,2x)** | 1.109 ms | **439 ms** | 1.008 → **76 ms** | 905 → **217 ms** | 10/10 → **0/10** |
| **Pedidos → Pagamentos** | 1.103 ms | **449 ms** | 1.002 ms | **377 ms** | **-62,4% (2,7x)** | 1.085 ms | **473 ms** | 948 → **75 ms** | 863 → **215 ms** | 10/10 → **0/10** |
| **Pagamentos → Dashboard** | 1.247 ms | **400 ms** | 1.180 ms | **474 ms** | **-59,8% (2,5x)** | 1.284 ms | **996 ms** | 1.133 → **93 ms** | 1.048 → **295 ms** | 10/10 → **0/10** |

**Rotas Secundárias — Build Otimizado (warm p50):**

| Transição Secundária | ANTES p50 | **DEPOIS p50** | Ganho | Shell Remount |
|---|---:|---:|---:|---:|
| Dashboard → Membros | 846 ms | **350 ms** | **-58,6%** | Sim → **Não** |
| Membros → Configurações | 807 ms | **311 ms** | **-61,5%** | Sim → **Não** |
| Configurações → Painel Retail | 985 ms | **363 ms** | **-63,1%** | Sim → **Não** |
| Painel Retail → Atividades | 980 ms | **421 ms** | **-57,0%** | Sim → **Não** |
| Atividades → Dashboard | 1.091 ms | **416 ms** | **-61,9%** | Sim → **Não** |

### 9.2 Cenário A — Desenvolvimento (`pnpm dev:staging`, Webpack) e Comparação Turbopack

| Transição | Cold ANTES (Webpack) | Cold DEPOIS (Webpack) | Cold DEPOIS (Turbopack) | p50 ANTES (Webpack) | **p50 DEPOIS (Webpack)** | p50 DEPOIS (Turbopack) | p95 ANTES → DEPOIS (Webpack) | Feedback p50 (A→D) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Dashboard → Produtos** | 7.574 ms | **4.424 ms** | 2.673 ms | 1.756 ms | **692 ms** (-60,6%) | 855 ms | 3.347 → **999 ms** | 1.718 → **104 ms** |
| **Produtos → Categorias** | 8.227 ms | **2.880 ms** | 2.337 ms | 1.616 ms | **650 ms** (-59,8%) | 995 ms | 3.494 → **739 ms** | 1.583 → **90 ms** |
| **Categorias → Pedidos** | 18.000 ms | **4.745 ms** | 3.329 ms | 1.679 ms | **656 ms** (-60,9%) | 1.043 ms | 2.025 → **1.068 ms** | 1.644 → **97 ms** |
| **Pedidos → Pagamentos** | 10.093 ms | **7.158 ms** | 3.120 ms | 1.657 ms | **708 ms** (-57,3%) | 1.034 ms | 2.418 → **1.048 ms** | 1.610 → **101 ms** |
| **Pagamentos → Dashboard** | 2.731 ms | **1.165 ms** | 1.182 ms | 2.258 ms | **983 ms** (-56,5%) | 1.318 ms | 4.995 → **1.382 ms** | 2.226 → **90 ms** |

---

## 10. Regressões Verificadas e Testes Executados

| Validação | Comando / Escopo | Resultado |
|---|---|---|
| Integridade arquitetural | `pnpm check:project` | **PASS** (zero importação de `src/modules` em `src/core`) |
| Tipagem estrita | `pnpm typecheck` | **PASS** (`0` erros) |
| Lint | `pnpm lint` | **PASS** (`0` erros, `0` warnings) |
| Testes unitários (incl. HMAC Auth Bridge) | `pnpm vitest run tests/unit/` | **PASS** — `20/20` arquivos, **`109/109` testes** |
| Testes reais PostgreSQL Staging (RLS, FORCE RLS, RBAC, Multiempresa, Catálogo, Storefront, Pedidos, Pagamentos Sandbox, Segurança API) | `DEVESSENT_ENV_FILE=.env.staging.local pnpm vitest run --fileParallelism=false ...` | **PASS** — `9/9` arquivos, **`86/86` testes** |
| Build de produção Staging | `pnpm build:staging` | **PASS** (27 rotas compiladas sem avisos) |
| E2E Playwright (Owner 8 abas, Detalhe, `goBack`, Dark/Light, Mobile Drawer, Multi-Tenant Switch, Staff RBAC `/forbidden`, Platform Admin 4 rotas, Vitrine Pública) | `e2e_perf_regression.mjs` contra `pnpm start:staging` | **PASS** — `5/5` cenários, **`0` console errors**, **`0` page errors**, **`0` shell remounts** |
| Integridade dos dados demonstrativos | `pnpm staging:seed:status` | **PASS** — Ateliê & Verde intactos (7 contas, 7 pedidos, 16 variantes, 7 imagens Storage) |

---

## 11. Limitações de Hardware Local Medidas

Auditoria de hardware realizada via `Get-CimInstance` / `Get-PhysicalDisk`:

- **CPU:** Intel Core i5-10210U (4 núcleos / 8 threads @ 1,60 GHz base).
- **Memória RAM:** 8.023 MB totais com apenas ~271 MB livres durante a execução (`C:\pagefile.sys` com 6.225 MB alocados e 2.936–4.044 MB em uso ativo).
- **Armazenamento:** O drive `C:\` é um SSD NVMe de 128 GB, porém o repositório `D:\Documentos\Projetos\DevEssent-platform` reside em um **HDD mecânico de 1 TB `WDC WD10SPZX-21Z10T0` (5400 RPM)**.

**Impacto medido:** Em `pnpm dev:staging`, o Webpack realiza milhares de chamadas `stat()` / leitura de módulos sobre o HDD 5400 RPM sob pressão de paginação de RAM, explicando a diferença restante entre `pnpm dev:staging` (`650–983 ms` p50) e `pnpm start:staging` (`321–474 ms` p50), bem como as compilações frias iniciais (`2,8–7,1 s`).

---

## 12. Limitações do Supabase Free e Rede Cloud

- Cada requisição de navegação dinâmica autenticada em SSR exige no mínimo **2 roundtrips HTTPS sequenciais** até `auebnppzxcvtaaqqlbts.supabase.co` (`sa-east-1`):
  1. Middleware `supabase.auth.getUser()` (`~68–101 ms`) — obrigatório para validação autoritativa de sessão/revogação e refresh de cookies.
  2. Lote paralelo da página (`resolveWorkspaceSession()` + consultas RLS da rota, `~75–105 ms`).
- Somando-se ~25–40 ms de serialização RSC + ~110–135 ms de reconciliação/pintura React no navegador local, **`~300–380 ms` representa o piso físico realista** rodando `localhost` contra o Supabase Cloud a ~75–100 ms de RTT.
- Como estamos no plano **Supabase Free**, evitamos deliberadamente prefetch agressivo em viewport ou polling em background para preservar conexões e cota do projeto.

---

## 13. O Que Ainda Depende de Deploy Real (Cloudflare / Produção)

- Quando a aplicação estiver hospedada em ambiente cloud colocalizado em São Paulo (`sa-east-1` / edge Sul-Americano próximo ao Supabase `sa-east-1`), o RTT servidor→Supabase cairá de `~75–100 ms` (residencial → nuvem) para **`~5–20 ms`** (datacenter → datacenter).
- Com os **2 RTTs paralelos** que a aplicação agora executa, o tempo de resposta RSC no servidor em produção tende a cair de `194–295 ms` para **`~35–70 ms`**, levando a navegação completa (com dados reais) para a faixa de **`~120–220 ms`**.
- Além disso, o servidor em produção executará exclusivamente o bundle compilado (sem Webpack/Turbopack dev) em SSD/NVMe e com HTTP/2/HTTP/3 multiplexado + CDN para assets estáticos.

---

## 14. Recomendações Futuras (Sem Urgência Nesta Fase)

1. **Mover o repositório local para SSD (se houver espaço disponível no futuro):** Em desenvolvimento (`next dev`), um SSD NVMe reduz substancialmente a compilação fria e o `rscP50` em dev.
2. **Desacoplar o barrel `@/modules/retail` nas rotas públicas `/loja/[slug]/**`:** Atualmente as rotas públicas ainda possuem `176 kB` de `First Load JS` pelo mesmo barrel; aplicar imports diretos lá (em fase dedicada ao storefront) deve economizar ~55–65 kB também para o comprador final.
3. **Hospedagem de staging/produção em região sul-americana (`gru1` / `sa-east-1`):** Maximiza o ganho da redução para 2 RTTs, aproximando a experiência SSR multiempresa da instantaneidade de sites estáticos.
4. **Manter `DEVESSENT_PERF_TRACE` desligado por padrão:** Ativar pontualmente apenas em sessões de diagnóstico local.
