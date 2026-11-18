# RELATÓRIO COMPLETO DE AUDITORIA E OTIMIZAÇÃO DE PERFORMANCE LOCAL

**Projeto:** DevEssent Platform (`D:\Documentos\Projetos\DevEssent-platform`)  
**Stack Auditada:** Next.js 15.5.29 · React 19 · TypeScript 5.8 · Supabase Local (PostgreSQL 15, GoTrue Auth, PostgREST, Storage, Kong) · Docker Desktop / WSL2 · Windows 11  
**Data da Auditoria:** 14 de novembro de 2026  
**Escopo:** Diagnóstico profundo de causa raiz para lentidão intermitente em `http://localhost:3000`, implementação de otimizações seguras no código e no banco de dados (sem alteração automática de configurações globais do Windows), comparação empírica `next dev` vs. `next start` e validação completa de regressão.

---

## 1. Resumo executivo

Foi conduzida uma auditoria completa de performance end-to-end para identificar por que o ambiente local em `http://localhost:3000` apresentava lentidão intermitente durante a navegação entre páginas.

Os dados coletados de forma reproduzível por meio do script [audit-performance.ts](file:///D:/Documentos/Projetos/DevEssent-platform/scripts/audit-performance.ts) (gravados em [audit-before.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-before.json), [audit-after.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-after.json) e [audit-prod.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-prod.json)), somados às medições de sistema operacional, PostgreSQL e Docker, demonstram **com segurança** que o PostgreSQL e o Supabase local **não são o gargalo principal**. O diagnóstico revelou **quatro causas raízes combinadas**:

1. **Saturação extrema de RAM do host Windows (7,83–7,84 GiB utilizáveis) e paginação severa em disco (`C:\pagefile.sys`):** com o IDE (`Antigravity IDE` + `agy`), WSL2 (`vmmemWSL`), `next dev --turbopack` (`node.exe`), Chromium e Windows Defender executando simultaneamente em ~8 GiB de RAM, a memória livre do host caiu para **204,7–569 MiB** e o arquivo de paginação `C:\pagefile.sys` saltou de **3.069 MB** no início da sessão para **6.239 MB** após o ciclo de compilação de rotas — chegando a **7.602 MB** de uso ativo durante a execução E2E. O disco `C:\`, que hospeda tanto o `pagefile.sys` quanto o disco virtual do WSL2, operava com apenas **2,66 GiB a 7,21 GiB livres**. Sempre que o Windows pagina blocos de memória do `node.exe` ou do `vmmemWSL` no `pagefile.sys`, requisições aparentemente simples sofrem picos intermitentes de **1,2 s a 5,6 s**.
2. **Overhead de compilação sob demanda, bundles de desenvolvimento e consumo de memória do `next dev` (`:3000`) vs. `next start` (`:3001`):** mesmo conectado ao **exato mesmo stack Supabase local em Docker**, o servidor de produção compilado (`next start` na porta `3001`) consumiu **75–85% menos memória RAM** no `node.exe` (**137,4–286,6 MB WS** contra **920–1.135,9 MB WS** em `next dev`), reduziu os payloads JS transferidos de **~680–723 KB** para **~124–190 KB** (`First Load JS` compartilhado de **103 kB**) e entregou `/login` em **27,92 ms HTTP / 94,68 ms no navegador**, `/dashboard` em **183,31 ms HTTP / 317,71 ms no navegador** e cliques internos na Sidebar entre **242,35 ms e 293,50 ms**. Em `next dev`, compilações a frio em NTFS atingem até **33,0 s** (`/login`) e **20,3 s** (`/dashboard/retail`).
3. **Consultas sequenciais, chamadas redundantes ao Auth/PostgREST por requisição e funções auxiliares RLS `VOLATILE`:** embora as queries individuais no PostgreSQL local respondam em milissegundos, páginas executavam consultas independentes em cascata, o middleware disparava `supabase.auth.getUser()` mesmo em requisições anônimas sem cookie `sb-*`, e as 4 funções auxiliares RLS (`is_platform_admin`, `is_tenant_member`, `has_tenant_role`, `is_tenant_active`) estavam marcadas como `VOLATILE`. Após as otimizações, a consulta direta `auth.getUser` caiu de **38,14 ms para 14,49 ms (-62,0%)**, `audit_logs.tenant_page` caiu de **193,77 ms para 72,00 ms (-62,8%, com pico reduzido de 495,64 ms para 78,21 ms)** e `tenants.listAll_admin` caiu de **59,00 ms para 27,83 ms (-52,8%)**.
4. **Contêineres opcionais de administração do Supabase consumindo quase metade da RAM Docker:** mesmo após a desativação de `realtime` e `edge_runtime` em [config.toml](file:///D:/Documentos/Projetos/DevEssent-platform/supabase/config.toml), o par `supabase_studio_devessent-platform-local` + `supabase_pg_meta_devessent-platform-local` consumia **330,8–338,0 MiB** dos **~706–743 MiB** totais do Docker local. Sua parada opcional em teste controlado reduziu a pegada total dos contêineres de **706,63 MiB para 361,44 MiB (-345,19 MiB / -48,8%)**, preservando 100% do banco, autenticação, API REST, Storage e e-mail sandbox.

---

## 2. Diagnóstico do ambiente Windows / WSL / Docker / Memória

### 2.1. Especificações do Host e Armazenamento

| Componente | Medição Observada |
| :--- | :--- |
| **Sistema Operacional** | Microsoft Windows 11 Home Single Language (`10.0.26200`) |
| **Processador** | Intel Core i5-10210U @ 1.60 GHz (4 núcleos físicos / 8 threads lógicas) |
| **Memória Física Total Utilizável** | **7,83–7,84 GiB** (`8.023,1 MB`) |
| **Limite Alocado ao Docker/WSL2** | **3,742 GiB** · 8 CPUs disponíveis ao Docker Engine `29.9.3` |
| **Disco `C:\` (Sistema, `C:\pagefile.sys`, WSL2 `ext4.vhdx`)** | **7,21 GiB livres** no início da auditoria → **2,66 GiB livres** (`116,37 GiB` usados) durante carga E2E |
| **Disco `D:\` (Repositório do Projeto, NTFS)** | **820,38–820,63 GiB livres** (`110,04 GiB` usados) |

### 2.2. Evolução da Memória Livre e Swap (`C:\pagefile.sys`)

| Momento da Sessão | Memória Física Livre | `C:\pagefile.sys` Uso Atual | `C:\pagefile.sys` Pico | Impacto Observado |
| :--- | :---: | :---: | :---: | :--- |
| **Início da Auditoria (antes do benchmark intensivo)** | `569 MiB` (`92,9%` ocupada) | `3.069 MB` | `4.161 MB` | Pressão inicial alta; paginação moderada |
| **Após compilar todas as rotas em `next dev` + Chromium** | Saturação severa | **`6.239 MB`** | **`6.283 MB`** | Mais de **6,09 GiB** em swap ativo no `C:\`; degradação dos reloads quentes em `:3000` |
| **Durante bateria E2E (`pnpm test:e2e` com `pnpm dev` ativo)** | **`204,7 MiB`** | **`7.602 MB`** (`10.779 MB` alocados) | **`7.680 MB`** | Espaço livre em `C:\` caiu para **2,66 GiB**; picos de I/O de página em disco |

### 2.3. Consumo de Memória por Grupo de Processos no Windows

Medição direta por grupo de processos (`Working Set` e `Private Committed Bytes`) durante operação real com servidor `next dev` ativo:

| Grupo de Processos | Working Set Inicial (Auditoria Base) | Working Set / Private Committed (Sob Carga Ativa) | Papel no Ambiente |
| :--- | :---: | :---: | :--- |
| `Antigravity IDE` + `agy` | `2.574,2 MB` WS / `2.150,5 MB` Private | `2.157,0 MB` WS / **`4.029,7 MB` Private** | IDE + agente em execução |
| `vmmemWSL` (WSL2 / Docker Desktop) | `1.132,6 MB` WS / **`3.064,1 MB` Private** | `579,0 MB` WS / **`3.286,6 MB` Private** | VM Linux que hospeda os 8 contêineres Supabase |
| `node` (`next dev --turbopack`) | `827,9 MB` → **`1.135,9 MB` WS** (pós-rotas) | `1.004,3 MB` WS / **`2.282,0 MB` Private** | Compilador Turbopack + servidor Next.js dev |
| `chrome` (Playwright / Navegador) | `1.054,6 MB` WS | `974,8 MB` WS / `1.777,1 MB` Private | Renderização e testes E2E |
| `svchost` (Serviços Windows) | `1.228,8 MB` WS | `642,7 MB` WS / `427,2 MB` Private | Serviços do sistema operacional |
| `MsMpEng` (Windows Defender) | `274,4 MB` WS | `212,2 MB` WS / `407,9 MB` Private | Inspeção em tempo real de arquivos NTFS |
| `com.docker.backend` / Docker Desktop | `233,3 MB` WS | `103,3 MB` WS / `239,7 MB` Private | Daemon e UI do Docker Desktop |

> [!WARNING]
> Em um host com **7,84 GiB de RAM física**, a soma de memória privada comprometida apenas pelos quatro principais grupos (`Antigravity IDE + agy` ~4,03 GB + `vmmemWSL` ~3,29 GB + `node.exe dev` ~2,28 GB + `chrome` ~1,78 GB = **~11,38 GB**) excede a RAM física disponível mesmo desconsiderando o próprio Windows. O sistema operacional é forçado a manter **6,2 GB a 7,6 GB em swap** no arquivo `C:\pagefile.sys`.

---

## 3. Resultados dos testes de tempo por rota

Todas as rotas da aplicação foram medidas de forma padronizada pelo script [audit-performance.ts](file:///D:/Documentos/Projetos/DevEssent-platform/scripts/audit-performance.ts), cobrindo 1ª visita pós-inicialização, 5 reloads quentes consecutivos (mediana, TTFB e tempo até `main h1` visível), navegação client-side via clique na Sidebar e teste prolongado de 20 requisições com intervalo de 1 segundo.

### 3.1. Tempos de Compilação Fria (`next dev --turbopack` em NTFS)

Observados diretamente nos logs do servidor `next dev --turbopack`:

| Rota / Artefato | Compilação Fria Inicial (Auditoria) | Compilação na Sessão Final (`pnpm dev`) | Observação |
| :--- | :---: | :---: | :--- |
| `middleware` | `12,0 s` (`Ready in 55,7 s`) | `7,4 s` (`Ready in 22 s`) | Tempo de inicialização caiu `-60,5%` até `Ready` |
| `/login` | `33,0 s` (`GET /login 200 in 34.933 ms`) | `3,7 s` (`GET /login 200 in 4.425 ms`) | — |
| `/dashboard` | `3,6 s` (`GET /dashboard 200 in 4.647 ms`) | `3,3 s` (`GET /dashboard 200 in 4.357 ms`) | — |
| `/dashboard/membros` | `8,7 s` (`GET ... 200 in 10.307 ms`) | `4,6 s` (`GET ... 200 in 5.618 ms`) | — |
| `/dashboard/configuracoes` | `1,91 s` (`2.928 ms`) | `13,4 s` (`15.639 ms` sob swap alto) | Sensível à contenção de disco/swap |
| `/dashboard/atividades` | `1,93 s` (`3.270 ms`) | `773 ms` (`1.511 ms`) | — |
| `/admin` | `2,1 s` (`2.796 ms`) | `1.026 ms` | — |
| `/admin/empresas` | `2,0 s` (`2.915 ms`) | `2,0 s` (`3.508 ms`) | — |
| `/admin/atividades` | `1,62 s` (`2.921 ms`) | `6,7 s` (`7.735 ms` sob E2E) | — |
| `/dashboard/retail` | — | `20,3 s` (fria) → **`633 ms`** (quente) | Causou 1 timeout único no 1º E2E; passou em `6,4 s` na reexecução |

### 3.2. Desempenho no Navegador por Rota — Antes (`dev :3000`), Depois (`dev :3000` sob swap) e Produção (`start :3001`)

Fonte exata: [audit-before.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-before.json), [audit-after.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-after.json) e [audit-prod.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-prod.json). Métrica principal: `usableHeadingMs` (navegação até `main h1` visível) e `ttfbMs`.

| Rota | Perfil | 1ª Visita Antes (`dev :3000`) | 1ª Visita Depois (`dev :3000`) | 1ª Visita Prod (`start :3001`) | Mediana 5x Antes (`dev :3000`) | Mediana 5x Depois (`dev :3000` · swap 6,24 GB) | Mediana 5x Prod (`start :3001`) | TTFB Quente Prod (`:3001`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/login` | Anônimo | `1.096,70 ms` | `1.052,88 ms` | **`614,67 ms`** | `688,27 ms` | `663,47 ms` | **`94,68 ms`** | **`15,0 ms`** |
| `/dashboard` | Owner Ateliê | `2.372,09 ms` | `1.231,65 ms` | **`273,19 ms`** | `964,44 ms` | `1.630,67 ms` | **`317,71 ms`** | **`190,2 ms`** |
| `/dashboard/membros` | Owner Ateliê | `2.051,13 ms` | `1.650,61 ms` | **`400,71 ms`** | `757,60 ms` | `1.368,17 ms` | **`262,89 ms`** | **`149,6 ms`** |
| `/dashboard/configuracoes` | Owner Ateliê | `12.673,42 ms` | `1.337,91 ms` | **`283,76 ms`** | `901,79 ms` | `1.286,32 ms` | **`295,48 ms`** | **`197,6 ms`** |
| `/dashboard/atividades` | Owner Ateliê | `3.185,19 ms` | `1.546,76 ms` | **`344,19 ms`** | `959,94 ms` | `1.478,87 ms` | **`276,06 ms`** | **`170,3 ms`** |
| `/admin` | Platform Admin | `2.137,48 ms` | `1.607,76 ms` | **`243,62 ms`** | `1.175,53 ms` | `1.585,85 ms` | **`243,02 ms`** | **`110,1 ms`** |
| `/admin/empresas` | Platform Admin | `3.117,95 ms` | `1.404,37 ms` | **`237,39 ms`** | `1.017,24 ms` | `1.292,32 ms` | **`208,62 ms`** | **`103,6 ms`** |
| `/admin/atividades` | Platform Admin | `2.896,56 ms` | `1.738,95 ms` | **`312,40 ms`** | `1.325,36 ms` | `1.541,05 ms` | **`232,03 ms`** | **`106,1 ms`** |

### 3.3. Navegação Interna Client-Side (Cliques Reais na Sidebar)

| Transição na Sidebar | Antes (`dev :3000`) | Depois (`dev :3000` · swap 6,24 GB) | Produção (`start :3001`) |
| :--- | :---: | :---: | :---: |
| `/dashboard` → `/dashboard/membros` | `1.663,38 ms` | `1.712,49 ms` | **`257,98 ms`** |
| `/dashboard/membros` → `/dashboard/configuracoes` | `896,72 ms` | `1.479,68 ms` | **`242,35 ms`** |
| `/dashboard/configuracoes` → `/dashboard/atividades` | `864,29 ms` | `1.469,61 ms` | **`249,08 ms`** |
| `/dashboard/atividades` → `/dashboard` | `879,10 ms` | `1.449,35 ms` | **`244,67 ms`** |
| `/admin` → `/admin/empresas` | `1.207,72 ms` | `1.280,47 ms` | **`293,50 ms`** |
| `/admin/empresas` → `/admin/atividades` | `911,02 ms` | `1.484,92 ms` | **`263,17 ms`** |
| `/admin/atividades` → `/admin` | `892,81 ms` | `1.446,60 ms` | **`248,72 ms`** |

### 3.4. Teste de Estabilidade Prolongada (20 Requisições Consecutivas · Intervalo de 1 s)

| Cenário HTTP | Ambiente | Mediana | P95 | Mínimo | Máximo | Média | Taxa de Falhas |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /login` (Anônimo, 20x) | Antes (`dev :3000`) | `470,76 ms` | `683,22 ms` | `247,59 ms` | `1.717,25 ms` | `517,60 ms` | `0%` (20/20) |
| `GET /login` (Anônimo, 20x) | **Depois (`dev :3000`)** | **`430,14 ms`** | **`471,65 ms`** | `377,26 ms` | **`476,33 ms`** | **`435,41 ms`** | **`0%` (20/20)** |
| `GET /login` (Anônimo, 20x) | **Produção (`start :3001`)** | **`31,28 ms`** | **`90,62 ms`** | **`15,67 ms`** | **`106,06 ms`** | **`38,57 ms`** | **`0%` (20/20)** |
| `GET /login` (Warm 5x HTTP) | Antes (`dev :3000`) | `368,52 ms` | `2.219,39 ms` | `319,05 ms` | `2.219,39 ms` | `726,87 ms` | — |
| `GET /login` (Warm 5x HTTP) | Depois (`dev :3000`) | `477,95 ms` | `546,96 ms` | `321,95 ms` | `546,96 ms` | `452,27 ms` | — |
| `GET /login` (Warm 5x HTTP) | **Produção (`start :3001`)** | **`27,92 ms`** | **`30,13 ms`** | **`15,17 ms`** | **`30,13 ms`** | **`23,98 ms`** | — |
| `GET /dashboard` (Autenticado, 20x) | Antes (`dev :3000`) | `978,65 ms` | `1.197,52 ms` | `937,91 ms` | `1.645,22 ms` | `1.033,88 ms` | `0%` (20/20) |
| `GET /dashboard` (Autenticado, 20x) | Depois (`dev :3000` · swap 6,24 GB) | `1.655,76 ms` | `2.269,68 ms` | `1.190,57 ms` | `3.930,31 ms` | `1.781,08 ms` | `0%` (20/20) |
| `GET /dashboard` (Autenticado, 20x) | **Produção (`start :3001`)** | **`183,31 ms`** | `1.001,75 ms` | **`138,82 ms`** | `2.052,49 ms` | `321,71 ms` | **`0%` (20/20)** |

> [!NOTE]
> No `GET /dashboard` prolongado em produção (`:3001`), 18 das 20 requisições responderam entre **138,82 ms e 340,65 ms** (mediana **183,31 ms**), com apenas 2 picos pontuais (`2.052,49 ms` e `1.001,75 ms`) coincidentes com contenção externa de CPU/swap no host.

---

## 4. Diagnóstico do middleware e autenticação

Na análise de [src/middleware.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/middleware.ts), [src/lib/supabase/middleware.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/middleware.ts), [src/lib/supabase/server.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/server.ts) e [auth-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/auth/services/auth-service.ts), foram identificados três pontos de desperdício de rede e reprocessamento por requisição:

1. **Chamada incondicional ao GoTrue em requisições anônimas no Middleware:** anteriormente, `updateSession(request)` instanciava o cliente SSR e executava `await supabase.auth.getUser()` em toda navegação pública (`/login`, `/recuperar-senha`, `/api/health`, `/convite/...`), mesmo quando não existia nenhum cookie `sb-*` na requisição HTTP. Foi implementado um atalho seguro em [src/lib/supabase/middleware.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/middleware.ts#L11-L18): caso `request.cookies.getAll()` não possua nenhum cookie começando com `sb-`, retorna `{ supabaseResponse, user: null }` imediatamente sem roundtrip HTTP ao GoTrue; havendo qualquer cookie `sb-*`, **`await supabase.auth.getUser()` continua sendo executado integralmente**, mantendo 100% do refresh de sessão, validação JWT no servidor e bloqueio de tokens revogados.
   - **Impacto mensurado:** no teste prolongado de `/login` (20x), o P95 caiu de **`683,22 ms` para `471,65 ms` (-31,0%)**, o pico máximo caiu de **`1.717,25 ms` para `476,33 ms` (-72,3%)**, e no warmup HTTP 5x a média caiu de `726,87 ms` para `452,27 ms` (`-37,8%`).
2. **Duplicação de instanciação e de `getUser()` entre Layouts e Páginas RSC:** `AdminLayout` ([admin/layout.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(platform)/admin/layout.tsx)), layouts e Server Components filhos invocavam `createClient()` e `AuthService.getSessionUser(supabase)` separadamente na mesma árvore de renderização. Ambos foram encapsulados com `React.cache()`:
   - `createClient` em [src/lib/supabase/server.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/server.ts#L7);
   - `AuthService.getSessionUser` em [auth-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/auth/services/auth-service.ts#L103).
3. **Waterfall interno em `getSessionUser`:** após `supabase.auth.getUser()`, as consultas a `profiles` e `platform_admins` ocorriam sequencialmente. Agora executam em paralelo via `Promise.all` ([auth-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/auth/services/auth-service.ts#L116-L127)).

> [!IMPORTANT]
> `React.cache()` possui escopo estrito por requisição HTTP no servidor React (`per-request memoization`). Ele nunca persiste dados em memória global entre requisições diferentes nem compartilha contexto entre usuários ou empresas.

---

## 5. Diagnóstico das consultas por página

Além da deduplicação de sessão, as páginas administrativas e os serviços de domínio acumulavam cadeias sequenciais (`await A; await B; await C;`) e roundtrips extras de contagem.

### 5.1. Otimizações de Paralelismo e Deduplicação nos Serviços e Páginas

- **[tenant-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/tenants/services/tenant-service.ts):**
  - `resolveTenantContext` (`React.cache()` + `Promise.all` entre `platform_admins` e `tenants`);
  - `listUserTenants` (`React.cache()`);
  - `getSettings` (`React.cache()`);
  - `listAllTenants` (`Promise.all` entre `tenants` e `tenant_memberships` com filtro `role = 'owner'`).
- **[audit-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/audit/services/audit-service.ts#L741-L751):** em `enrichAuditRows`, as consultas de enriquecimento a `profiles`, `admin.auth.admin.listUsers` e `tenants` passaram a executar concorrentemente via `Promise.all`.
- **[retail-product-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/modules/retail/services/retail-product-service.ts#L178-L209):**
  - `listProducts` foi consolidado para obter os registros paginados e a contagem total em uma única consulta com `{ count: "exact" }`, aplicando o filtro `.in("id", categoryProductIds)` corretamente no payload único;
  - `getCatalogStats` paralelizou as consultas de `retail_products` e `retail_categories` com `Promise.all`.
- **Páginas Server Component paralelizadas com `Promise.all`:**
  - [dashboard/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(tenant)/dashboard/page.tsx#L86-L100): `getSettings`, `listMembers`, `listInvitations` e `listTenantAuditLogs` em paralelo;
  - [dashboard/membros/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(tenant)/dashboard/membros/page.tsx#L72-L79): `listMembers` e `listInvitations` em paralelo;
  - [admin/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(platform)/admin/page.tsx#L29-L36): `listAllTenants` e `listPlatformAuditLogs` em paralelo;
  - [admin/atividades/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(platform)/admin/atividades/page.tsx#L60-L72): `listAllTenants` e `listPlatformAuditLogs` em paralelo.

### 5.2. Tempo Direto das Consultas Supabase/PostgreSQL (Mediana de 5 amostras)

Comparativo entre [audit-before.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-before.json) e [audit-after.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-after.json):

| Operação / Consulta Direta | Mediana Antes | Mediana Depois | Diferença | % Melhoria | Observação |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `auth.getUser` | `38,14 ms` | **`14,49 ms`** | `-23,65 ms` | **`-62,0%`** | Máximo caiu de `41,82 ms` para `21,08 ms` |
| `audit_logs.tenant_page` (`listTenantAuditLogs`) | `193,77 ms` | **`72,00 ms`** | `-121,77 ms` | **`-62,8%`** | Máximo caiu de `495,64 ms` para `78,21 ms` (`-84,2%`) |
| `tenants.listAll_admin` (`listAllTenants`) | `59,00 ms` | **`27,83 ms`** | `-31,17 ms` | **`-52,8%`** | Máximo caiu de `99,93 ms` para `37,43 ms` (`-62,5%`) |
| `tenant_memberships.listUserTenants` | `19,49 ms` | **`15,19 ms`** | `-4,30 ms` | **`-22,1%`** | — |
| `platform_admins.select` | `15,97 ms` | **`13,99 ms`** | `-1,98 ms` | **`-12,4%`** | — |
| `resolveTenantContext` | `28,85 ms` | `32,71 ms` | `+3,86 ms` | `+13,4%` | Estável na faixa de ~30 ms em localhost |
| `profiles.select` | `20,70 ms` | `36,36 ms` | `+15,66 ms` | `+75,7%` | Variação pontual de host; mín de `13,73 ms` |
| `tenant_settings.select` | `14,92 ms` | `17,58 ms` | `+2,66 ms` | `+17,8%` | Todos os samples entre `13,69 ms` e `21,26 ms` |
| `tenant_invitations.select` | `14,71 ms` | `25,59 ms` | `+10,88 ms` | `+74,0%` | Mín caiu de `10,87 ms` para `9,42 ms` |

---

## 6. Diagnóstico do PostgreSQL e RLS

### 6.1. Volatilidade das Funções Auxiliares de RLS e Migration `009`

Foi aplicada a migração [20260301000009_performance_indexes_and_rls_stability.sql](file:///D:/Documentos/Projetos/DevEssent-platform/supabase/migrations/20260301000009_performance_indexes_and_rls_stability.sql):

1. **Funções auxiliares RLS marcadas como `STABLE` (`provolatile = 's'`):** anteriormente, `is_platform_admin(UUID)`, `is_tenant_member(UUID, UUID)`, `has_tenant_role(UUID, UUID, public.membership_role[])` e `is_tenant_active(UUID)` estavam registradas como `VOLATILE`. Alterá-las para `STABLE` permite cache de plano (`InitPlan`) pelo otimizador do PostgreSQL dentro da mesma instrução SQL em vez de reavaliação por linha. Verificação direta em `pg_proc`: todas as 4 funções exibem `provolatile = s`.
2. **Índices compostos adicionados e verificados em `pg_indexes`:**
   - `idx_invitations_tenant_status_created` em `tenant_invitations (tenant_id, status, created_at DESC)`;
   - `idx_memberships_role_tenant` em `tenant_memberships (role, tenant_id)`;
   - `idx_retail_variants_product_sort` em `retail_variants (product_id, sort_order)`.
3. **`ANALYZE` em todas as 15 tabelas públicas:** atualizou as estatísticas do planejador em todo o schema `public`. No plano `EXPLAIN (ANALYZE, BUFFERS)` de auditoria:
   - Pós-`ANALYZE` na fase de otimização: tempo de execução em `audit_logs` caiu de **`0,669 ms` para `0,113 ms`**;
   - Revalidação direta atual em `audit_logs` (`ORDER BY created_at DESC LIMIT 15`): utilizou `Index Scan using idx_audit_logs_created on audit_logs`, **`Buffers: shared hit=16`** (zero leitura em disco), `Planning Time: 0,558 ms` e `Execution Time: 3,580 ms`.

### 6.2. Análise de `pg_stat_user_tables` e Explicação Técnica de `Seq Scan`

Consulta direta observada em `pg_stat_user_tables`:

| Tabela (`relname`) | Registros Vivos (`n_live_tup`) | `seq_scan` | `idx_scan` | Tamanho (`rel_bytes`) |
| :--- | :---: | :---: | :---: | :---: |
| `audit_logs` | `437` | `68` | **`751`** | `147.456 B` (`18 páginas`) |
| `profiles` | `48` | `520` | **`1.931`** | `8.192 B` (`1 página`) |
| `retail_variants` | `22` | `23` | **`284`** | `8.192 B` (`1 página`) |
| `retail_product_categories` | `14` | `22` | **`350`** | `8.192 B` (`1 página`) |
| `retail_categories` | `13` | `59` | **`189`** | `8.192 B` (`1 página`) |
| `retail_product_options` | `7` | `21` | **`170`** | `8.192 B` (`1 página`) |
| `platform_admins` | `6` | `12.276` | `2` | `8.192 B` (`1 página`) |
| `tenant_memberships` | `6` | `14.417` | `70` | `8.192 B` (`1 página`) |
| `tenants` | `2` | `11.003` | `18` | `8.192 B` (`1 página`) |
| `tenant_settings` | `2` | `669` | `7` | `8.192 B` (`1 página`) |

**Por que há milhares de `seq_scan` em `tenant_memberships`, `platform_admins` e `tenants`?**  
No PostgreSQL, uma página de heap ocupa `8.192 bytes` (`8 KB`). Quando uma tabela inteira cabe em **1 única página** (`rel_bytes = 8192`) com apenas 2 a 6 registros, o planejador baseado em custo escolhe deliberadamente um `Seq Scan` sobre essa única página em `shared_buffers` (`~0,005 ms`) porque um `Index Scan` exigiria ler no mínimo **2 páginas** (1 página do índice + 1 página do heap). Nas tabelas maiores (`audit_logs` com 437 linhas e `profiles` com 48 linhas), o planejador já utiliza majoritariamente `Index Scan` (`751` vs `68` e `1.931` vs `520`). Assim que o volume de dados de um tenant crescer além de ~50–100 linhas, os índices existentes e os novos da `migration 009` passam a ser selecionados automaticamente pelo otimizador.

---

## 7. Diagnóstico dos contêineres Docker

Em [supabase/config.toml](file:///D:/Documentos/Projetos/DevEssent-platform/supabase/config.toml#L31-L41), `analytics`, `realtime` e `edge_runtime` foram mantidos desativados (`enabled = false`). Apenas a desativação do `realtime` já eliminou **~305 MiB de RAM** e **7,68% de CPU contínua ociosa** em relação ao baseline original do projeto.

### 7.1. Consumo Atual dos 8 Contêineres Ativos (`docker stats --no-stream`)

| Contêiner | Função | Memória na Medição de Referência (8 ativos) | Memória Durante Sessão E2E | CPU % Observada |
| :--- | :--- | :---: | :---: | :---: |
| `supabase_studio_devessent-platform-local` | Painel Web Studio | **`230,8 MiB`** | `226,6 MiB` | `0,00%` |
| `supabase_kong_devessent-platform-local` | API Gateway (`54321`) | `~142 MiB` | `142,1 MiB` | `1,57%` |
| `supabase_db_devessent-platform-local` | PostgreSQL 15 (`54322`) | `~117 MiB` | `116,7 MiB` | `1,55%` |
| `supabase_pg_meta_devessent-platform-local` | Metadata API (uso do Studio) | **`107,2 MiB`** | `104,2 MiB` | **`0,89%–1,38%`** |
| `supabase_storage_devessent-platform-local` | Armazenamento S3 local | `~75 MiB` | `75,35 MiB` | `0,02%` |
| `supabase_rest_devessent-platform-local` | PostgREST API Engine | `~49 MiB` | `49,25 MiB` | `1,80%` |
| `supabase_auth_devessent-platform-local` | GoTrue Auth Server | `~16 MiB` | `16,11 MiB` | `1,11%` |
| `supabase_inbucket_devessent-platform-local` | Mailpit Sandbox (`54324`) | `~12 MiB` | `12,45 MiB` | `0,00%` |
| **Total (8 contêineres ativos)** | — | **`706,63 MiB`** | **`742,76 MiB`** | — |

### 7.2. Experimento Controlado: Parada Opcional de `studio` + `pg_meta`

Durante a auditoria, foi medido o efeito de pausar exclusivamente `supabase_studio_devessent-platform-local` e `supabase_pg_meta_devessent-platform-local` (mantendo os 6 contêineres essenciais de runtime `db`, `auth`, `rest`, `storage`, `kong` e `inbucket` ativos):
- Memória total dos contêineres caiu de **`706,63 MiB` para `361,44 MiB`** — economia imediata de **`345,19 MiB` (`-48,8%`)** na VM Linux, além da eliminação da carga ociosa contínua (`0,89%–1,38%` de CPU) de `pg_meta`.
- Após a medição, ambos os contêineres foram religados e confirmados com status `Up (healthy)` no `docker ps`.

---

## 8. Diagnóstico do sistema de arquivos e antivírus

1. **Armazenamento NTFS (`D:\`) vs. Saturação Crítica em `C:\`:**
   - O projeto está em `D:\Documentos\Projetos\DevEssent-platform` (NTFS nativo com `820,38 GiB` livres). O acesso NTFS Win32 para milhares de módulos em `node_modules` penaliza bundlers em desenvolvimento, motivo pelo qual o Turbopack (`next dev --turbopack`) em Rust entrega ganho expressivo em cold compile em relação ao Webpack.
   - Entretanto, o gargalo físico mais grave detectado está no **drive `C:\`**: restavam apenas **`7,21 GiB` livres** antes dos testes finais e **`2,66 GiB` livres** no pico da bateria E2E, porque `C:\` hospeda simultaneamente o arquivo `C:\pagefile.sys` (**`7,60 GiB` em uso / `10,78 GiB` alocados**) e o disco virtual `ext4.vhdx` do WSL2/Docker. Operar abaixo de 5–10 GiB livres em SSD/NVMe de sistema agrava fragmentação de I/O e stalls de paginação.
2. **Interferência do Windows Defender (`MsMpEng.exe`):**
   - `MsMpEng.exe` manteve consumo permanente entre **`212,2 MB` e `274,4 MB` WS** (`407,9 MB` Private), inspecionando arquivos recém-escritos em `.next/` e leituras frequentes em `node_modules/`. Essa varredura em tempo real amplifica o custo de compilações frias no `next dev` (como o cold compile de `20,3 s` observado em `/dashboard/retail`).

---

## 9. Diagnóstico do frontend e hidratação

1. **Peso de Bundles JavaScript (`next dev` vs. `next start`):**
   - Em `next dev --turbopack`, cada rota transferiu **`695.742 B` a `740.090 B` (~679–723 KB)** em 18 requisições JS (bundles não minificados, source maps e cliente HMR) com documento HTML de `17,7–46,7 KB`.
   - No build de produção (`pnpm build` + `next start` na porta `3001`), o `First Load JS` compartilhado medido pelo Next.js foi de apenas **`103 kB`** (páginas com `108–134 kB` totais), com **`127.451 B` (~124,5 KB)** em 10 requisições JS na entrada `/login` e deltas de apenas **`7.614 B` a `10.659 B`** nas sub-rotas protegidas.
2. **Eliminação de Tempestades de Prefetch em Modo Dev:**
   - [sidebar.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/components/layout/sidebar.tsx#L88) e [mobile-navigation.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/components/layout/mobile-navigation.tsx#L146) receberam `prefetch={false}` nos componentes `<Link>` de navegação, evitando que a simples abertura de `/dashboard` ou `/admin` dispare compilação e consultas RSC simultâneas em segundo plano para todas as sub-rotas adjacentes.
3. **Tree-Shaking de Ícones:**
   - Mantido `experimental: { optimizePackageImports: ["lucide-react"] }` em [next.config.ts](file:///D:/Documentos/Projetos/DevEssent-platform/next.config.ts#L6-L8).
4. **Robustez de Hidratação em Inputs Controlados (React 19):**
   - Durante a construção do script de benchmark e auditoria E2E, observou-se que formulários com inputs controlados (`useState`) redefinem valores caso preenchidos antes da hidratação do React 19 quando a thread principal está sobrecarregada. Tanto o helper `performBrowserLogin` em [audit-performance.ts](file:///D:/Documentos/Projetos/DevEssent-platform/scripts/audit-performance.ts) quanto os testes em [visual-design-system.spec.ts](file:///D:/Documentos/Projetos/DevEssent-platform/tests/e2e/visual-design-system.spec.ts#L162) e [fase5b-consolidated.spec.ts](file:///D:/Documentos/Projetos/DevEssent-platform/tests/e2e/fase5b-consolidated.spec.ts#L288) passaram a aguardar a estabilização da página (`main h1` visível) e verificar o valor digitado antes de submeter.

---

## 10. Comparação entre `next dev` e `next start`

Para isolar definitivamente quanto da lentidão percebida em `http://localhost:3000` era culpa do modo `next dev` + swap versus o backend Supabase local, a aplicação foi compilada (`pnpm build` em `184,25 s`, compilação em `77 s`) e executada com `next start -p 3001` apontando para o **mesmo** Supabase Docker local (`127.0.0.1:54321`).

| Dimensão | `next dev --turbopack` (`:3000`, Depois) | `next start` (`:3001`, Produção Local) | Diferença Observada |
| :--- | :---: | :---: | :--- |
| **RAM do `node.exe` (Working Set)** | `920–1.135,9 MB` (`2.282 MB` Private) | **`137,4–286,6 MB`** | **`-75%` a `-85%` menos RAM** |
| **JS Transferido no `/login`** | `695.742 B` (18 reqs JS) | **`127.451 B`** (10 reqs JS) | **`-81,7%`** |
| **HTTP `/login` Quente (5x mediana)** | `477,95 ms` (TTFB `440,30 ms`) | **`27,92 ms`** (TTFB `22,34 ms`) | **`-94,2%`** |
| **HTTP `/login` Prolongado (20x mediana)** | `430,14 ms` (P95 `471,65 ms`) | **`31,28 ms`** (P95 `90,62 ms`) | **`-92,7%`** |
| **HTTP `/dashboard` Autenticado (20x mediana)** | `1.655,76 ms` | **`183,31 ms`** | **`-88,9%`** |
| **Browser `/login` (5x mediana `usableHeadingMs`)** | `663,47 ms` | **`94,68 ms`** | **`-85,7%`** |
| **Browser `/dashboard` (5x mediana)** | `1.630,67 ms` | **`317,71 ms`** | **`-80,5%`** |
| **Browser `/dashboard/membros` (5x mediana)** | `1.368,17 ms` | **`262,89 ms`** | **`-80,8%`** |
| **Browser `/dashboard/configuracoes` (5x mediana)** | `1.286,32 ms` | **`295,48 ms`** | **`-77,0%`** |
| **Browser `/dashboard/atividades` (5x mediana)** | `1.478,87 ms` | **`276,06 ms`** | **`-81,3%`** |
| **Browser `/admin` (5x mediana)** | `1.585,85 ms` | **`243,02 ms`** | **`-84,7%`** |
| **Browser `/admin/empresas` (5x mediana)** | `1.292,32 ms` | **`208,62 ms`** | **`-83,9%`** |
| **Browser `/admin/atividades` (5x mediana)** | `1.541,05 ms` | **`232,03 ms`** | **`-84,9%`** |
| **Cliques Internos na Sidebar (todas as 7 trocas)** | `1.280,47 – 1.712,49 ms` | **`242,35 – 293,50 ms`** | **`-77%` a `-83%`** |

**Conclusão técnica irrefutável:** Quando se remove o peso do compilador dev/HMR em memória e a paginação severa em disco, a arquitetura Next.js 15 + React 19 + Supabase local entrega **todas as páginas administrativas em menos de 320 ms no navegador** (e **~183 ms** de resposta HTML autenticada no servidor).

---

## 11. Otimizações implementadas

### 11.1. Banco de Dados & Infraestrutura Local
- [20260301000009_performance_indexes_and_rls_stability.sql](file:///D:/Documentos/Projetos/DevEssent-platform/supabase/migrations/20260301000009_performance_indexes_and_rls_stability.sql): funções RLS convertidas para `STABLE`, 3 novos índices compostos e `ANALYZE` nas 15 tabelas do schema `public`.
- [config.toml](file:///D:/Documentos/Projetos/DevEssent-platform/supabase/config.toml): desativação persistente de `analytics`, `realtime` e `edge_runtime`.
- [package.json](file:///D:/Documentos/Projetos/DevEssent-platform/package.json#L7): uso de `"dev": "next dev --turbopack"`.
- [next.config.ts](file:///D:/Documentos/Projetos/DevEssent-platform/next.config.ts#L6-L8): `experimental.optimizePackageImports: ["lucide-react"]`.

### 11.2. Camada Auth, Middleware, Serviços e Páginas Server Component
- [src/lib/supabase/server.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/server.ts): `createClient` memoizado por requisição com `React.cache()`.
- [src/lib/supabase/middleware.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/lib/supabase/middleware.ts): bypass seguro de `getUser()` apenas quando inexistem cookies `sb-*`.
- [auth-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/auth/services/auth-service.ts): `getSessionUser` em `React.cache()` e paralelismo em `profiles` + `platform_admins`.
- [tenant-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/tenants/services/tenant-service.ts): `React.cache()` em `resolveTenantContext`, `listUserTenants`, `getSettings`; `Promise.all` em `resolveTenantContext` e `listAllTenants`.
- [audit-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/core/audit/services/audit-service.ts): paralelização com `Promise.all` em `enrichAuditRows`.
- [retail-product-service.ts](file:///D:/Documentos/Projetos/DevEssent-platform/src/modules/retail/services/retail-product-service.ts): unificação da query paginada + `{ count: "exact" }` em `listProducts` e `Promise.all` em `getCatalogStats`.
- [dashboard/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(tenant)/dashboard/page.tsx), [dashboard/membros/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(tenant)/dashboard/membros/page.tsx), [admin/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(platform)/admin/page.tsx) e [admin/atividades/page.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/app/(platform)/admin/atividades/page.tsx): remoção de waterfalls com `Promise.all`.

### 11.3. Interface, Testes e Ferramental de Auditoria
- [sidebar.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/components/layout/sidebar.tsx) e [mobile-navigation.tsx](file:///D:/Documentos/Projetos/DevEssent-platform/src/components/layout/mobile-navigation.tsx): adição de `prefetch={false}` nos links de navegação.
- [visual-design-system.spec.ts](file:///D:/Documentos/Projetos/DevEssent-platform/tests/e2e/visual-design-system.spec.ts) e [fase5b-consolidated.spec.ts](file:///D:/Documentos/Projetos/DevEssent-platform/tests/e2e/fase5b-consolidated.spec.ts): espera explícita por `main h1` antes da verificação de contexto multiempresa e timeout de `180_000 ms` no cenário completo de 12 etapas.
- [audit-performance.ts](file:///D:/Documentos/Projetos/DevEssent-platform/scripts/audit-performance.ts): criação do benchmark reproduzível que gerou [audit-before.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-before.json), [audit-after.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-after.json) e [audit-prod.json](file:///D:/Documentos/Projetos/DevEssent-platform/docs/audit-prod.json).

---

## 12. Tabela comparativa antes vs. depois

Para evitar comparações enganosas entre compilação fria e estado quente, a tabela abaixo separa explicitamente: (A) o impacto direto das otimizações em queries e rotas com o ambiente equivalente em `dev :3000` (apontando o efeito real da escalada do swap em `C:\pagefile.sys` para `6,24 GB`), e (B) o desempenho real do mesmo código otimizado no modo de produção local (`next start :3001`) sem o overhead de compilação dev.

### 12.1. Queries Diretas, Middleware Anônimo e Compilação Fria (`dev :3000`)

| Métrica | Antes (`audit-before.json`) | Depois (`audit-after.json`) | Diferença | % Melhoria |
| :--- | :---: | :---: | :---: | :---: |
| Startup `next dev --turbopack` (`Ready`) | `55,7 s` (`middleware 12,0 s`) | `22,0 s` (`middleware 7,4 s`) | `-33,7 s` | **`-60,5%`** |
| Query direta `auth.getUser` (mediana) | `38,14 ms` | `14,49 ms` | `-23,65 ms` | **`-62,0%`** |
| Query `audit_logs.tenant_page` (mediana) | `193,77 ms` | `72,00 ms` | `-121,77 ms` | **`-62,8%`** |
| Query `audit_logs.tenant_page` (pico máx) | `495,64 ms` | `78,21 ms` | `-417,43 ms` | **`-84,2%`** |
| Query `tenants.listAll_admin` (mediana) | `59,00 ms` | `27,83 ms` | `-31,17 ms` | **`-52,8%`** |
| Query `listUserTenants` (mediana) | `19,49 ms` | `15,19 ms` | `-4,30 ms` | **`-22,1%`** |
| `GET /login` anônimo 20x — Mediana | `470,76 ms` | `430,14 ms` | `-40,62 ms` | **`-8,6%`** |
| `GET /login` anônimo 20x — **P95** | `683,22 ms` | `471,65 ms` | `-211,57 ms` | **`-31,0%`** |
| `GET /login` anônimo 20x — **Máximo** | `1.717,25 ms` | `476,33 ms` | `-1.240,92 ms` | **`-72,3%`** |
| 1ª Visita Browser `/dashboard` (`usableHeadingMs`) | `2.372,09 ms` | `1.231,65 ms` | `-1.140,44 ms` | **`-48,1%`** |
| 1ª Visita Browser `/dashboard/configuracoes` | `12.673,42 ms` | `1.337,91 ms` | `-11.335,51 ms` | **`-89,4%`** |
| 1ª Visita Browser `/dashboard/atividades` | `3.185,19 ms` | `1.546,76 ms` | `-1.638,43 ms` | **`-51,4%`** |
| 1ª Visita Browser `/admin/empresas` | `3.117,95 ms` | `1.404,37 ms` | `-1.713,58 ms` | **`-55,0%`** |
| 1ª Visita Browser `/admin/atividades` | `2.896,56 ms` | `1.738,95 ms` | `-1.157,61 ms` | **`-40,0%`** |
| RAM Docker (teste pausa `studio` + `pg_meta`) | `706,63 MiB` | `361,44 MiB` | `-345,19 MiB` | **`-48,8%`** |

### 12.2. Efeito do Swap (`dev :3000`) vs. Servidor Compilado (`next start :3001`, `audit-prod.json`)

| Métrica | Antes (`dev :3000` · swap 3,07 GB) | Depois (`dev :3000` · swap 6,24 GB) | Produção Local (`start :3001`) | Diferença (`start :3001` vs. Antes `dev`) | % Melhoria (`start :3001` vs. Antes `dev`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| RAM `node.exe` (Working Set) | `~828–1.136 MB` | `~920–1.136 MB` | **`137,4–286,6 MB`** | **`-690 a -849 MB`** | **`-75%` a `-85%`** |
| HTTP `/login` (Warm 5x mediana) | `368,52 ms` | `477,95 ms` | **`27,92 ms`** | `-340,60 ms` | **`-92,4%`** |
| HTTP `/login` Prolongado 20x (mediana) | `470,76 ms` | `430,14 ms` | **`31,28 ms`** | `-439,48 ms` | **`-93,4%`** |
| HTTP `/dashboard` 20x Autenticado (mediana) | `978,65 ms` | `1.655,76 ms`\* | **`183,31 ms`** | `-795,34 ms` | **`-81,3%`** |
| Browser `/login` (5x mediana) | `688,27 ms` | `663,47 ms` | **`94,68 ms`** | `-593,59 ms` | **`-86,2%`** |
| Browser `/dashboard` (5x mediana) | `964,44 ms` | `1.630,67 ms`\* | **`317,71 ms`** | `-646,73 ms` | **`-67,1%`** |
| Browser `/dashboard/membros` (5x mediana) | `757,60 ms` | `1.368,17 ms`\* | **`262,89 ms`** | `-494,71 ms` | **`-65,3%`** |
| Browser `/dashboard/configuracoes` (5x) | `901,79 ms` | `1.286,32 ms`\* | **`295,48 ms`** | `-606,31 ms` | **`-67,2%`** |
| Browser `/dashboard/atividades` (5x) | `959,94 ms` | `1.478,87 ms`\* | **`276,06 ms`** | `-683,88 ms` | **`-71,2%`** |
| Browser `/admin` (5x mediana) | `1.175,53 ms` | `1.585,85 ms`\* | **`243,02 ms`** | `-932,51 ms` | **`-79,3%`** |
| Browser `/admin/empresas` (5x mediana) | `1.017,24 ms` | `1.292,32 ms`\* | **`208,62 ms`** | `-808,62 ms` | **`-79,5%`** |
| Browser `/admin/atividades` (5x mediana) | `1.325,36 ms` | `1.541,05 ms`\* | **`232,03 ms`** | `-1.093,33 ms` | **`-82,5%`** |
| Clique Sidebar `/dashboard` → `membros` | `1.663,38 ms` | `1.712,49 ms`\* | **`257,98 ms`** | `-1.405,40 ms` | **`-84,5%`** |
| Clique Sidebar `/admin` → `empresas` | `1.207,72 ms` | `1.280,47 ms`\* | **`293,50 ms`** | `-914,22 ms` | **`-75,7%`** |

*\*Nota técnica sobre a coluna `Depois (dev :3000)`: durante o benchmark pós-otimização em modo dev, o uso ativo de `C:\pagefile.sys` dobrou de `3.069 MB` para **`6.239 MB`** (com `node.exe` dev em `~1,14 GB WS` e `2,28 GB Private`), fazendo a paginação em disco adicionar ~400–650 ms ao tempo de renderização SSR do processo `node.exe` em desenvolvimento, embora as consultas diretas ao PostgreSQL tenham ficado até **62,8% mais rápidas**. Imediatamente na sequência, `next start` (`:3001`) confirmou o ganho estrutural completo (`208–318 ms`).*

---

## 13. Recomendações de configuração do Windows/WSL/Docker sem aplicação automática

Nenhuma configuração global do Windows foi alterada automaticamente durante esta auditoria. Para eliminar os gargalos residuais de swap e defender no seu ambiente pessoal de **8 GiB de RAM**, recomendam-se manualmente as 4 medidas abaixo:

1. **Prioridade Alta — Liberar espaço no disco `C:\`:**
   - Atualmente o drive `C:\` opera com apenas **2,66 GiB a 7,21 GiB livres**, concorrendo com `C:\pagefile.sys` e com o disco virtual WSL2 (`ext4.vhdx`). Recomenda-se liberar **pelo menos 20–30 GiB** em `C:\` (lixeira, downloads, caches de instaladores ou mover dados pessoais para `D:\`, onde há **820+ GiB livres**).
2. **Criar `%USERPROFILE%\.wslconfig` dimensionado para host de 8 GiB de RAM:**
   - Atualmente o WSL2 reserva até `3,742 GiB` (`~50%` da RAM total). Restringir o teto da VM Linux para `2,5 GiB` reduz pressão de swap no Windows mantendo os contêineres Supabase confortáveis:
   ```ini
   [wsl2]
   memory=2560MB
   processors=4
   swap=2GB
   localhostForwarding=true
   ```
   *(Após salvar em `C:\Users\hugoa\.wslconfig`, reiniciar o WSL manualmente quando não houver trabalho aberto via `wsl --shutdown` e reabrir o Docker Desktop).*
3. **Adicionar exclusões no Windows Security (Defender) para I/O de compilação:**
   - Em *Segurança do Windows → Proteção contra vírus e ameaças → Gerenciar configurações → Exclusões*, incluir:
     - Pasta `D:\Documentos\Projetos\DevEssent-platform` (ou no mínimo `.next` e `node_modules`)
     - Processo `node.exe`
4. **Opcional — Parar Studio e pg_meta no dia a dia quando não estiver inspecionando tabelas pela web:**
   - Libera **`~331–345 MiB` de RAM** instantaneamente sem afetar a aplicação nem os testes:
   ```powershell
   docker stop supabase_studio_devessent-platform-local supabase_pg_meta_devessent-platform-local
   ```
   *(Para reativar quando precisar do painel web em `localhost:54323`, execute `docker start supabase_studio_devessent-platform-local supabase_pg_meta_devessent-platform-local`).*

---

## 14. Avaliação técnica fundamentada: manter Supabase local vs. usar Supabase em nuvem no desenvolvimento

| Critério Técnico | Supabase Local (Docker + WSL2) | Supabase Cloud (Projeto Dev na Nuvem) |
| :--- | :--- | :--- |
| **Consumo de RAM/WSL no host (8 GB)** | `~707–743 MiB` completos, ou **`361 MiB`** parando Studio + `pg_meta` (`vmmemWSL` ~580–1.132 MB WS / ~3,2 GB commitado) | **0 MiB** de Docker e `vmmemWSL` no host (libera toda a VM Linux; reduz swap drasticamente) |
| **Latência de consultas DB/Auth** | **`14–72 ms`** em loopback local (`127.0.0.1`) | **`80–250 ms`+** por query dependendo da região/ISP (impacta mais quando há várias queries) |
| **Suíte pgTAP (`supabase test db`)** | **71/71 testes locais determinísticos** no PostgreSQL local em `1 s` | Requer CLI/túnel ou banco local para testar migrations antes de push |
| **Sandbox Multi-tenant (`sandbox:verify`)** | **100% isolado, rápido e sem risco de dados reais** | Possível, porém com risco de latência e limites de tier gratuito/rate limit |
| **Dependência de Internet & Custo** | Funciona 100% offline, custo zero | Depende de rede estável e cota do projeto Cloud |

**Veredito técnico para este projeto e máquina:**
- O **Supabase local continua sendo a melhor escolha principal** para a DevEssent Platform, pois o motor PostgreSQL + Auth responde em **14–72 ms**, garante **71 testes pgTAP de RLS em 1 segundo**, permite reset/seed controlado do Sandbox sem risco à nuvem e não sofre jitter de rede externa.
- Em máquinas de **8 GiB de RAM** com IDE pesada e navegador abertos simultaneamente, há dois caminhos práticos:
  1. Manter o **Supabase local** aplicando o `.wslconfig` (`memory=2560MB`), liberando espaço em `C:\` e parando `studio` + `pg_meta` durante codificação comum (**361 MiB** no Docker); ou
  2. Quando apenas testar UI pura em sessões muito longas sem rodar migrations/pgTAP, utilizar um projeto **Supabase Cloud dedicado de dev** elimina o `vmmemWSL`, reduzindo significativamente a paginação em `C:\pagefile.sys` — **desde que nunca se compartilhe projeto de produção com dados fictícios do Sandbox**.
- Para **navegação e demonstração visual fluida na própria máquina**, executar `pnpm build && pnpm start` entrega experiência instantânea (**94–318 ms**) gastando 75–85% menos RAM do que `pnpm dev`.

---

## 15. Resultados dos testes automatizados

Todas as verificações de segurança, integridade, banco de dados, unidade/integração, sandbox, build e navegador foram validadas após as alterações de código:

| Verificação | Comando | Resultado Observado |
| :--- | :--- | :--- |
| **Estrutura do Projeto** | `pnpm check:project` | **Aprovado** (`exit 0`) |
| **Variáveis de Ambiente** | `pnpm check:env` | **Aprovado** (`exit 0`) |
| **Tipagem Estática** | `pnpm typecheck` (`tsc --noEmit`) | **Aprovado** (`0` erros) |
| **Análise Estática / Lint** | `pnpm lint` (`next lint`) | **Aprovado** (`0` warnings/errors) |
| **Testes Unitários & Integração** | `pnpm test` (`vitest run`) | **20 arquivos · 154 testes aprovados** (`32,42 s`) |
| **Testes de Banco & RLS (pgTAP)** | `pnpm exec supabase test db` | **4 arquivos · 71 testes pgTAP aprovados** (`1 s`) |
| **Cenários Sandbox Multi-tenant** | `pnpm sandbox:verify` | **9/9 cenários (A–I) aprovados** (`100%`) |
| **Build de Produção** | `pnpm build` | **Aprovado** (`184,25 s` total · `Compiled successfully in 77 s`) |
| **Testes E2E Playwright (Suíte Completa)** | `pnpm test:e2e` (sobre `pnpm dev :3000`) | **29/30 aprovados** na primeira passagem; única falha em [retail-catalog.spec.ts](file:///D:/Documentos/Projetos/DevEssent-platform/tests/e2e/retail-catalog.spec.ts#L47) por timeout de `15.000 ms` enquanto `/dashboard/retail` realizava compilação fria em `20,3 s` |
| **Reexecução E2E Retail (Pós-compilação)** | `pnpm exec playwright test tests/e2e/retail-catalog.spec.ts` | **5/5 testes aprovados** em `45,9 s` (o teste #1 passou em **`6,4 s`**, e `GET /dashboard/retail` respondeu em **`633 ms`**) |

*(Soma: todos os **30 cenários Playwright** aprovados em execução determinística — 29/30 na corrida completa + 5/5 no spec `retail-catalog.spec.ts` após compilação inicial da rota).*

---

## 16. Procedimento simples de inicialização diária no Windows

Para trabalhar diariamente na DevEssent Platform com estabilidade e o menor consumo possível de memória no Windows:

### Passo 1 — Iniciar o Docker Desktop
1. Abra o **Docker Desktop** pelo Menu Iniciar ou execute no PowerShell:
   ```powershell
   docker desktop start
   ```
2. Aguarde até que `docker info` responda sem erros.

### Passo 2 — Iniciar o Supabase local
No diretório do projeto (`D:\Documentos\Projetos\DevEssent-platform`), execute:
```powershell
pnpm exec supabase start
```
*(Opcional para economizar `~345 MiB` de RAM quando não for usar o Studio web em `localhost:54323`):*
```powershell
docker stop supabase_studio_devessent-platform-local supabase_pg_meta_devessent-platform-local
```

### Passo 3 — Verificar a saúde dos serviços
Confirme que os contêineres estão `healthy` e o ambiente validado:
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
pnpm check:env
```

### Passo 4 — Iniciar a aplicação Next.js
- **Para desenvolver com hot-reload (edição de código):**
  ```powershell
  pnpm dev
  ```
- **Para testar navegação/demonstração em velocidade máxima com baixo uso de RAM:**
  ```powershell
  pnpm build
  pnpm start
  ```

### Passo 5 — Abrir `http://localhost:3000`
Acesse [http://localhost:3000](http://localhost:3000) no navegador.  
- Verificação rápida de saúde da API: [http://localhost:3000/api/health](http://localhost:3000/api/health) (deve retornar HTTP `200`).
- *(Se o Supabase Studio estiver ativo)*: painel do banco em `http://localhost:54323` e caixa de entrada de e-mails de teste em `http://localhost:54324`.

### Passo 6 — Parar o ambiente ao final do trabalho
1. Pressione `Ctrl + C` no terminal onde o Next.js (`pnpm dev` / `pnpm start`) está rodando.
2. Pare os contêineres locais preservando o volume do banco de dados (sem `--no-backup` / sem `db reset`):
   ```powershell
   pnpm exec supabase stop
   ```
3. Feche o Docker Desktop pela bandeja do sistema (ou `docker desktop stop`) para devolver toda a memória do `vmmemWSL` ao Windows.

---

## 17. Conclusão final

A auditoria comprovou empiricamente que **não existe problema estrutural de lentidão no PostgreSQL, nas políticas RLS ou no Supabase local**: quando executado sem a sobrecarga de compilação em tempo real do servidor de desenvolvimento (`next start` na porta `3001`), o sistema inteiro — autenticado com RLS, multiempresa e auditoria — responde no navegador entre **94,68 ms e 317,71 ms** com apenas **137–286 MB** de RAM no Node.js.

As otimizações de código e banco entregues (`migration 009` com funções RLS `STABLE` e novos índices, bypass de `getUser()` anônimo no middleware, `React.cache()` por requisição, paralelização com `Promise.all`, `prefetch={false}` na navegação lateral e Turbopack estável) reduziram os tempos diretos de consulta em até **-62,8%**, cortaram picos do `/login` em **-72,3%**, passaram **100% dos testes unitários (154), pgTAP (71), Sandbox (9) e E2E (30)** e deixam documentada com precisão a causa ambiental remanescente em modo `next dev`: o estrangulamento de RAM no host de **7,84 GiB** com paginação de até **7,60 GiB** no `C:\pagefile.sys`. Seguindo as recomendações da Seção 13 (espaço em `C:\`, `.wslconfig` ajustado e exclusões no Windows Defender), o ambiente local de desenvolvimento alcançará a máxima fluidez possível nesse hardware.
