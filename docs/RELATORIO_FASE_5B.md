# DEVESSENT PLATFORM CORE — RELATÓRIO DE HOMOLOGAÇÃO DA FASE 5B
## Consolidação Operacional, Auditoria, Configurações Empresariais e Preparação do Core para Produtos Comerciais

**Projeto:** DevEssent Platform Core  
**Diretório:** `D:\Documentos\Projetos\DevEssent-platform`  
**Data:** 12 de Novembro de 2026  
**Status Geral:** 🟢 **FASE 5B CONCLUÍDA E HOMOLOGADA COM SUCESSO**  
**Ambiente de Execução:** Local Stack Docker (PostgreSQL 15 / Supabase local `127.0.0.1:54321` / `54322`, Next.js 15.5.29)  
**Conexões Remotas:** Nenhuma (100% de execução local, sem acesso a bancos ou serviços em nuvem)  
**Alterações no EJC ou Landing Page:** Nenhuma  

---

## 1. STATUS GERAL DA FASE 5B E CONFORMIDADE

A Fase 5B teve como objetivo consolidar a maturidade operacional, a segurança profunda, a governança de auditoria e a blindagem arquitetural do **DevEssent Platform Core** como fundação SaaS multiempresa de classe enterprise, preparando o terreno para futuros produtos verticais (Retail, CRM, Booking, Service) sem implementar qualquer lógica de domínio comercial prematura.

### Principais Marcos de Conformidade Aprovados:
1. **Zero Módulos Comerciais Desenvolvidos:** A fundação permaneceu agnóstica. `src/modules/` permanece vazio de regras comerciais, provido apenas de documentação arquitetural e contratos de consumo (`src/modules/README.md`).
2. **Preservação Integral do Design System e Redesign Aprovado:** Toda a identidade estética inspirada no Retail-OS e Vlom Custom foi rigorosamente mantida (Light Mode, Dark Mode e Sistema; fontes `Space Grotesk`, `Plus Jakarta Sans`, `IBM Plex Mono`; grid estrutural, tabelas de bordas limpas e sem cartões inchados).
3. **Auditoria Estruturada com Higienização Profunda:** Rastreamento persistente de ações administrativas e operacionais (`public.audit_logs`), com saneamento recursivo de chaves sensíveis e mascaramento de tokens JWT e credenciais.
4. **Governança RBAC nos Logs de Auditoria:** `platform_admin` visualiza auditoria global e por tenant; `owner` visualiza todos os eventos de sua empresa; `manager` visualiza estritamente eventos operacionais de membros, configurações e convites; `staff` tem acesso sumariamente negado em nível de serviço e banco de dados (`AccessDeniedState` 403).
5. **Ciclo de Vida de Convites e Reenvio Resiliente:** Tratamento transparente de convites pendentes, expirados e revogados. Autoexpiração de registros obsoletos impede colisões de constraint de unicidade (`tenant_id, lower(email) WHERE status = 'pending'`), viabilizando reenvio suave.
6. **Rate Limiting em Duas Camadas:** Camada de infraestrutura (GoTrue) somada à camada de persistência durável no PostgreSQL (`public.rate_limits`) com controle transacional atômico via RPC (`consume_rate_limit`) e `RateLimitService` no servidor Next.js.
7. **Isolamento de Estabelecimentos Suspensos:** Sub-rotas (`/dashboard/configuracoes`, `/dashboard/membros`, `/dashboard/atividades`) detectam suspensão via `resolveTenantContext` e renderizam de forma elegante e amigável o `SuspendedTenantState` em vez de falhas não tratadas.
8. **Normalização Amigável de Erros em Português:** Implementação de `toPublicErrorMessage` eliminando qualquer vazamento de SQLSTATE, PostgREST ou tokens para o usuário final.
9. **Zero Poluição do Banco de Dados:** Nenhum `supabase db reset` foi executado. O seed oficial do Sandbox permaneceu perfeitamente íntegro e operacional (2 empresas, 7 usuários, 6 vínculos, 3 convites controlados).

---

## 2. RESUMO DA MIGRATION `20260301000007_operational_audit_and_rate_limits.sql`

A migração incremental foi aplicada ao PostgreSQL local (`127.0.0.1:54322`) sem interrupção ou reset do banco de dados, complementando as migrações anteriores:

- **Índices de Performance para Auditoria:**
  - `idx_audit_logs_action_created`: indexação em `(action, created_at DESC)` para buscas rápidas por tipo de evento.
  - `idx_audit_logs_tenant_created`: indexação em `(tenant_id, created_at DESC)` para consultas filtradas por empresa.
  - `idx_audit_logs_actor_created`: indexação em `(actor_user_id, created_at DESC)` para auditoria de atividades de usuários específicos.
- **Harmonização de Marca e Cores:**
  - Atualização do valor padrão de `tenant_settings.primary_color` para `#5B46E5`, alinhado à paleta oficial aprovada no Design System.
- **Tabela Durável de Rate Limiting (`public.rate_limits`):**
  - Colunas: `key (TEXT PRIMARY KEY)`, `points (INTEGER NOT NULL)`, `expire_at (TIMESTAMPTZ NOT NULL)`, `created_at`, `updated_at`.
  - Segurança RLS: `ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY; ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;`.
  - Privilégios: Revogação total de `ALL` para as roles `PUBLIC`, `anon` e `authenticated`. Apenas `service_role` possui permissão de leitura e escrita.
- **Funções Transacionais com Bloqueio de Linha (`FOR UPDATE`):**
  - `public.consume_rate_limit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)`: função `SECURITY DEFINER` que insere ou atualiza atomicamente os pontos acumulados, bloqueando a linha para prevenir race conditions e retornando `allowed`, `remaining_points`, `retry_after_seconds` e `reset_at`.
  - `public.reset_rate_limit(p_key TEXT)`: função `SECURITY DEFINER` para liberação imediata de limites após sucesso ou reset manual.
  - Ambas as funções tiveram seus privilégios de execução revogados de `PUBLIC`, `anon` e `authenticated`, sendo exclusivas da `service_role`.

---

## 3. RELAÇÃO DE TABELAS, ÍNDICES E FUNÇÕES SQL DO CORE

O esquema consolidado do banco de dados na Fase 5B apresenta a seguinte topologia:

### 3.1. Tabelas do Core
1. `public.profiles`: Perfis de usuários autenticados vinculados ao `auth.users`.
2. `public.tenants`: Entidades multiempresa (estabelecimentos/empresas) com controle de status (`active`, `suspended`).
3. `public.tenant_memberships`: Vínculos associativos com papéis RBAC (`owner`, `manager`, `staff`).
4. `public.tenant_settings`: Configurações operacionais, contato, monograma e identidade visual da unidade.
5. `public.tenant_invitations`: Convites de ingresso com tokens criptográficos, prazo de validade e controle de estado.
6. `public.platform_admins`: Registro restrito de administradores soberanos da plataforma.
7. `public.audit_logs`: Registro histórico imutável de eventos administrativos e operacionais.
8. `public.rate_limits`: Armazenamento durável de janelas e contadores anti-abuso.

### 3.2. Funções Críticas de Segurança e Governança
- `public.is_platform_admin(p_user_id UUID)`
- `public.current_tenant_role(p_tenant_id UUID)`
- `public.create_tenant_with_owner(...)`
- `public.accept_tenant_invitation(p_token TEXT, p_user_id UUID)`
- `public.consume_rate_limit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)`
- `public.reset_rate_limit(p_key TEXT)`

---

## 4. MATRIZ DE PERMISSÕES (RBAC) E ESCOPOS DE AUDITORIA

A matriz de controle de acesso foi formalizada e centralizada em `src/core/permissions/policies/role-matrix.ts` e aplicada no RLS do PostgreSQL:

| Recurso / Operação | Platform Admin | Owner | Manager | Staff |
|---|:---:|:---:|:---:|:---:|
| **Criar estabelecimento** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| **Suspender / reativar empresa** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| **Administrar qualquer empresa** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| **Visualizar área de trabalho** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Alterar configurações operacionais** | ✅ Sim | ✅ Sim | ✅ Sim | ❌ Não |
| **Gerenciar membros** | ✅ Sim | ✅ Sim | ⚠️ Limitado (Staff) | ❌ Não |
| **Promover a Manager / Owner** | ✅ Sim | ✅ Sim | ❌ Não | ❌ Não |
| **Remover Proprietário** | ❌ Bloqueado | ❌ Bloqueado (último) | ❌ Não | ❌ Não |
| **Emitir / revogar convites** | ✅ Sim | ✅ Sim | ⚠️ Limitado (Staff) | ❌ Não |
| **Visualizar auditoria do tenant** | ✅ Total | ✅ Total | ⚠️ Operacional | ❌ Proibido (403) |
| **Visualizar auditoria global** | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |

### Escopo Específico de Auditoria: `Owner` vs `Manager` vs `Staff`
- **Owner & Platform Admin:** Acesso total a todas as ações da empresa (`null` action filter), incluindo governança de criação, suspensão, reativação e configurações globais.
- **Manager:** Restrito estritamente a ações operacionais permitidas (`MANAGER_VISIBLE_AUDIT_ACTIONS`):
  - `tenant_settings.updated`
  - `invitation.created`, `invitation.revoked`, `invitation.accepted`
  - `member.role_updated`, `member.removed`
  - Se o gestor tentar filtrar ou pesquisar por ações restritas (ex: `tenant.created`, `tenant.suspended`), a consulta retorna 0 linhas de forma transparente sem quebrar a tela.
- **Staff:** Nenhuma visibilidade. O link de menu é ocultado da navegação e o acesso à URL `/dashboard/atividades` resulta em `AccessDeniedState` (403) com bloqueio adicional no RLS do PostgreSQL (`audit_logs_select_authorized`).

---

## 5. MECANISMO DE AUDITORIA ESTRUTURADA E HIGIENIZAÇÃO PROFUNDA

Implementado em `src/core/audit/services/audit-service.ts`, o serviço garante:

1. **Catalogo Canônico de Ações (`AUDIT_ACTION_CATALOG`):**
   - Nomes padronizados: `auth.login`, `auth.logout`, `tenant.created`, `tenant.suspended`, `tenant.reactivated`, `tenant_settings.updated`, `invitation.created`, `invitation.revoked`, `invitation.accepted`, `member.role_updated`, `member.removed`.
2. **Higienização Recursiva de Metadados (`sanitizeMetadata`):**
   - Chaves proibidas são sumariamente eliminadas do payload JSON: `password`, `token`, `secret`, `access_token`, `refresh_token`, `authorization`, `cookie`, `jwt`, `api_key`, `key`.
   - Expressões regulares de tokens sensíveis (como JWTs e tokens de convite) que possam residir em URLs ou strings informativas são redigidas para `[REDACTED]`.
3. **Visualizador de Logs Enterprise (`AuditLogViewer`):**
   - Tabela responsiva no padrão Retail-OS com colunas: Data/Hora, Ação (badge semântico), Ator (com avatar e monograma), Estabelecimento, Resumo e Ação de Detalhes.
   - Modal nativo acessível `<dialog>` exibindo metadados JSON higienizados com quebra de linha limpa e proteção contra clique acidental.
   - Filtros de busca textual por ator/resumo e seleção por intervalo de datas.

---

## 6. TRATAMENTO DE CONVITES (CICLO DE VIDA, EXPIRAÇÃO E REENVIO)

O gerenciamento de convites em `src/core/tenants/services/invitation-service.ts` e `src/components/dashboard/members-manager.tsx` resolveu as seguintes complexidades:

1. **Eliminação de Colisão de Unicidade em Reenvios:**
   - O PostgreSQL mantinha a restrição única parcial `(tenant_id, lower(email)) WHERE status = 'pending'`. Quando um convite expirava cronologicamente (`expires_at <= now()`), o registro permanecia no banco com `status = 'pending'`, bloqueando a emissão de um novo convite para o mesmo e-mail (erro `23505`).
   - O Core agora inspeciona se existe convite pendente expirado antes da emissão. Caso positivo, atualiza atomicamente o registro anterior para `status = 'expired'` utilizando cliente administrativo seguro, permitindo a inserção imediata do novo convite sem falhas.
2. **Cálculo de Situação em Tempo Real:**
   - Na listagem de convites, o status retornado calcula dinamicamente se o registro está expirado com base no carimbo de data/hora atual.
3. **Aba de Histórico e Filtros no Gerenciador:**
   - O painel de membros agora oferece abas de filtragem (`Todos`, `Pendentes`, `Expirados / Revogados`).
   - Convites expirados ou revogados exibem a ação de **Reenviar**, que dispara o fluxo de emissão limpo com geração de novo link seguro.
4. **Proteção de Copiar Link:**
   - O botão de cópia de link (`CopyLinkButton`) segue as diretrizes do Modern Web Guidance: permanece interativo após o clique (não fica desabilitado), exibe feedback de sucesso transitório e notifica leitores de tela via `role="status"`.

---

## 7. FORMULÁRIOS OPERACIONAIS E VALIDAÇÃO DE TELEFONE

As interfaces administrativas foram atualizadas com foco na usabilidade empresarial:

1. **Validação Aprimorada de Telefone de Contato:**
   - O schema Zod (`src/core/tenants/schemas/settings.schema.ts`) aceita telefones brasileiros formatados (ex: `(11) 98888-1001`, `(11) 3456-7890`), números nacionais sem máscara (`11988881001`) e padrão internacional E.164 (`+5511999998888`).
   - O placeholder visual foi atualizado para `(11) 98888-1001`.
2. **Acessibilidade Aprimorada nos Formulários:**
   - Anúncio acessível de erros por campo via `role="alert"`, `aria-invalid="true"` e vinculação explícita via `aria-describedby="error-<field>"`.
   - Foco automático no primeiro campo inválido após submissão malsucedida.
   - Monograma da empresa normalizado automaticamente para caixa alta (letras maiúsculas).
3. **Modal de Confirmação para Alterações Críticas de Papel:**
   - Alterações de papel de membros no painel de equipe exibem um modal nativo acessível de confirmação, detalhando o impacto de rebaixamento ou promoção antes de efetivar a Server Action.

---

## 8. TRATAMENTO DE ESTABELECIMENTOS SUSPENSOS EM SUB-ROTAS

Garantia de que a suspensão administrativa de uma empresa pelo Platform Admin bloqueie imediatamente o acesso em todas as superfícies da aplicação:

1. **Detecção Centralizada em Server Components:**
   - A função `resolveTenantContext()` valida o status da empresa. Ao detectar `status === 'suspended'`, lança `TenantSuspendedError`.
2. **Blindagem de Todas as Sub-rotas Operacionais:**
   - As páginas `/dashboard`, `/dashboard/membros`, `/dashboard/configuracoes` e `/dashboard/atividades` interceptam o `TenantSuspendedError` e renderizam de forma graciosa o componente `SuspendedTenantState`.
   - O usuário não sofre redirecionamentos em loop nem telas brancas com erro 500: recebe aviso explícito de suspensão operacional e botão para alternar de empresa ou entrar em contato com o suporte.
3. **Bloqueio em Convites:**
   - Convites de estabelecimentos suspensos têm o fluxo de aceite bloqueado na tela pública de aceite (`/convite/[token]`), impedindo a admissão de novos integrantes em empresas inativas.

---

## 9. NORMALIZAÇÃO SEGURA DE ERROS EM PORTUGUÊS

A biblioteca de tratamento de exceções em `src/core/errors/public-error.ts` introduziu a função `toPublicErrorMessage(error, defaultMessage)`:

- **Ocultação de Detalhes Técnicos:** Elimina menções a `SQLSTATE`, códigos Postgres (`23505`, `42501`), nomes de constraints internas, tabelas, colunas e tokens JWT.
- **Tradução de Regras de Negócio para Mensagens Claras:**
  - `duplicate key / 23505` ➔ `"Já existe um registro com os dados informados."`
  - `invalid email or password` ➔ `"E-mail corporativo ou senha incorretos."`
  - `rate limit / 429` ➔ `"Muitas tentativas em curto período. Aguarde alguns minutos."`
  - `tenant is suspended` ➔ `"Este estabelecimento está temporariamente suspenso."`
  - `divergent email` ➔ `"O convite foi emitido para outro endereço de e-mail."`
- **Extração de Erros de Campo (`getFieldErrorsFromError`):**
  - Converte erros de validação Zod diretamente em dicionários `{ [field]: "mensagem" }` para vinculação direta nos formulários.

---

## 10. PROTEÇÃO CONTRA ABUSO E RATE LIMITING EM DUAS CAMADAS

A DevEssent Platform Core implementa uma estratégia de defesa em duas camadas:

```
Requisição de Login / Recuperação / Convites
  │
  ├──► [Camada 1: GoTrue Rate Limiting]
  │      Controle embutido do Supabase Auth para tentativas de login e envio de e-mails
  │
  └──► [Camada 2: PostgreSQL public.rate_limits (Durável & Atômico)]
         RateLimitService (Node.js Server Actions)
           ├── Identificador SHA-256 anônimo (evita vazamento de PII na chave)
           ├── RPC atômica: public.consume_rate_limit(key, limit, window)
           │     ├── Row-Level Lock (FOR UPDATE)
           │     ├── Reset automático após expiração da janela
           │     └── SECURITY DEFINER (exclusivo para service_role)
           └── Lança RateLimitError (HTTP 429) com retryAfterSeconds
```

### Políticas Padronizadas (`RATE_LIMIT_POLICIES`):
- `AUTH_LOGIN`: 5 tentativas a cada 60 segundos por IP/e-mail.
- `AUTH_PASSWORD_RESET`: 3 solicitações a cada 15 minutos por e-mail.
- `INVITATION_DISPATCH`: 10 emissões a cada 10 minutos por estabelecimento.
- `INVITATION_ACCEPT`: 10 tentativas a cada 5 minutos por IP/token.

---

## 11. NAVEGAÇÃO ATUALIZADA (`Sidebar`, `MobileNavigation`, `Topbar`)

A estrutura de navegação do App Shell foi atualizada de forma sensível ao papel do usuário (`activeRole`):

- **Sidebar Desktop (`src/components/layout/sidebar.tsx`):**
  - Contexto da Plataforma: exibe link permanente para `/admin/atividades` com ícone `Activity`.
  - Contexto do Estabelecimento: link para `/dashboard/atividades` visível exclusivamente para usuários com papel `owner`, `manager` ou `platform_admin`. Usuários com papel `staff` não visualizam o link.
- **Mobile Navigation Drawer (`src/components/layout/mobile-navigation.tsx`):**
  - Mesma regra de visibilidade RBAC aplicada ao menu mobile nativo.
  - O drawer opera via `<dialog>` nativo, com fechamento automático em mudança de rota ou tecla `Escape`.
- **Topbar (`src/components/layout/topbar.tsx`):**
  - Mantém o seletor rápido de estabelecimentos, alternador de temas (Claro, Escuro, Sistema) e atalho de encerramento de sessão.

---

## 12. MANUTENÇÃO INTEGRAL DO DESIGN SYSTEM E REDESIGN APROVADO

Nenhum elemento cosmético foi degradado durante a Fase 5B:

1. **Tipografia:**
   - Display/Títulos: `Space Grotesk` com peso e tracking balanceados.
   - Corpo/Texto: `Plus Jakarta Sans`.
   - Métricas/Datas/Tokens: `IBM Plex Mono`.
2. **Paleta de Cores e Temas:**
   - Light Mode: superfícies claras com bordas neutras de alto contraste (`zinc-200`), acentos em índigo (`#5B46E5`) e badges semânticos.
   - Dark Mode: superfícies profundas (`zinc-950` / `zinc-900`) com bordas suaves (`zinc-800/80`) e tipografia nítida.
3. **Componentes Padronizados:**
   - `DevEssentMark` e `DevEssentWordmark` presentes nos cabeçalhos.
   - Padrão unificado de tabelas `DataTable` com `embedded` container e badges semânticos.
   - Modais nativos `<dialog>` com transição suave, acessíveis a leitores de tela.

---

## 13. DOCUMENTAÇÃO DE INTEGRAÇÃO PARA VERTICAIS FUTURAS

Foram produzidos e atualizados 5 documentos de arquitetura e integração:

1. `src/modules/README.md`: Contrato arquitetural detalhado para o futuro desenvolvimento de módulos comerciais, exemplificando o consumo correto dos serviços de autenticação, resolução de tenant, permissões RBAC, registro de auditoria e componentes de layout.
2. `docs/security.md`: Especificação técnica de segurança, matriz de privilégios, políticas de rate limiting e mecanismos de higienização de logs.
3. `docs/vertical-integration-guide.md`: Guia de 6 pontos para equipes que construirão verticais (Retail, CRM, etc.) sobre o Core.
4. `docs/architecture.md`: Seção 4 atualizada refletindo a consolidação operacional e serviços de rate limiting e auditoria.
5. `docs/database.md`: Documentação atualizada do schema incluindo a tabela `rate_limits` e os novos índices de auditoria.

---

## 14. RESULTADOS DOS TESTES UNITÁRIOS (VITEST)

Os testes unitários validam a robustez das funções puras, schemas de validação e matriz de permissões:

- `tests/unit/security/audit-and-error.test.ts` (3 testes): higienização recursiva de metadados, redação de JWTs/tokens e tradução segura de erros via `toPublicErrorMessage`.
- `tests/unit/tenants/settings-schema-fase5b.test.ts` (4 testes): validação de telefones com máscara brasileira, E.164 internacional e transformação em maiúsculas de monogramas.
- `tests/unit/permissions/role-matrix-fase5b.test.ts` (3 testes): permissões RBAC de auditoria e restrição de ações para `manager`.
- Demais testes unitários do Core: `auth-schema.test.ts`, `role-matrix.test.ts`, `settings-schema.test.ts`, `tenant-schema.test.ts`, `app-error.test.ts`, `tenant-brand.test.ts`.

**Total Unitário:** 51 testes aprovados (100% de sucesso).

---

## 15. RESULTADOS DOS TESTES DE INTEGRAÇÃO REAL (VITEST)

Executados contra o PostgreSQL e Supabase Auth locais reais rodando em Docker:

- `tests/integration/fase5b-operational-consolidation.test.ts` (8 blocos abrangendo os 14 cenários da Seção 8):
  1. Reenvio de convite expirado sem colisão de constraint de unicidade (`23505`).
  2. Aceite com sucesso do convite reenviado.
  3. Convite revogado permanece bloqueado e pode ser reenviado posteriormente.
  4. Validação de telefones brasileiros e monograma em caixa alta no banco.
  5. Higienização profunda de metadados em auditoria (remoção de chaves e redação de JWT).
  6. Rate limiting durável no PostgreSQL bloqueando excessos com HTTP 429.
  7. Owner visualiza todos os eventos de sua empresa na auditoria.
  8. Manager visualiza estritamente eventos operacionais (ações de governança retornam vazio).
  9. Staff recebe negação total de acesso à auditoria (`ForbiddenError`).
  10. Isolamento multiempresa impede leitura de auditoria entre estabelecimentos distintos.
  11. Proteção contra remoção do último proprietário do estabelecimento.
  12. Gestor não pode remover proprietário nem alterar papéis além de sua alçada.
  13. Empresa suspensa bloqueia sub-rotas operacionais e emissão de convites.
  14. Platform Admin consulta auditoria global com filtros de empresa e data.
- Demais suítes de integração: `tenant-multitenancy.test.ts` (15 testes), `auth-real-flow.test.ts` (6 testes), `api-security-audit.test.ts` (12 testes), `real-db-isolation.test.ts` (5 testes), `sandbox-infrastructure.test.ts` (17 testes), `multi-tenant-isolation.test.ts` (5 testes).

**Total Geral Vitest:** 16 arquivos de teste, **122 testes aprovados**, 0 falhas.

---

## 16. RESULTADOS DOS TESTES DE BANCO DE DADOS (pgTAP)

Executados diretamente no banco de dados via `supabase test db`:

- `supabase/tests/database/01_multi_tenant_rls.test.sql`: 19 asserções de isolamento RLS entre estabelecimentos, proteção de perfis e platform admins.
- `supabase/tests/database/02_invitations_and_memberships.test.sql`: 20 asserções de convites, restrições de unicidade, aceites e integridade referencial.
- `supabase/tests/database/03_audit_and_rate_limits.test.sql`: 11 asserções validando:
  - Existência e RLS da tabela `public.rate_limits`.
  - Negação de privilégios em `rate_limits` para `PUBLIC`, `anon` e `authenticated`.
  - Operação atômica da RPC `consume_rate_limit` (incremento e bloqueio).
  - Operação da RPC `reset_rate_limit`.
  - Existência dos novos índices em `audit_logs`.
  - Restrição de RLS em `audit_logs` garantindo que staff não consulte linhas.

**Total Geral pgTAP:** 3 arquivos, **50 testes aprovados**, 0 falhas (`Result: PASS`).

---

## 17. RESULTADOS DOS TESTES PONTA A PONTA (PLAYWRIGHT E2E)

Suíte completa executada contra `http://localhost:3000` cobrindo o ciclo de vida consolidado da Seção 9 em `tests/e2e/fase5b-consolidated.spec.ts` e suítes complementares:

1. **Passo 1 a 3:** Login de Proprietário (Clara Rocha), navegação para `/dashboard/atividades`, conferência do link na sidebar, verificação da tabela e modal nativo `<dialog>` de detalhes.
2. **Passo 4 a 5:** Login de Gestora (Beatriz Lima), validação de escopo operacional na auditoria e ausência de eventos de governança de criação/suspensão.
3. **Passo 6:** Login de Funcionário (Tiago Silveira), validação de ocultação do link na navegação e exibição do estado de acesso negado (`AccessDeniedState`) em `/dashboard/atividades`.
4. **Passo 7 a 9:** Acesso a `/dashboard/membros`, emissão de convite, cópia de link sem desabilitar o botão, expiração controlada e reenvio sem colisão 23505.
5. **Passo 10:** Acesso a `/dashboard/configuracoes`, preenchimento de telefone formatado `(11) 98888-1001` e monograma em caixa alta com persistência validada.
6. **Passo 11:** Login de Administrador Global (Vitor Hugo), verificação da listagem soberana em `/admin/atividades`, suspensão temporária do Ateliê Sandbox, validação imediata do bloqueio em `/dashboard/configuracoes` e reativação limpa.
7. **Passo 12:** Inspeção visual de responsividade (viewport desktop e mobile 390x844) e alternância perfeita entre Light Mode e Dark Mode.

**Total Geral Playwright:** **25 testes aprovados**, 0 falhas.

---

## 18. STATUS DE INTEGRIDADE DO AMBIENTE SANDBOX

Execução de `pnpm sandbox:verify` e `pnpm sandbox:status`:

- **Cenário A:** Proprietário (Owner) do Ateliê Sandbox — Aprovado.
- **Cenário B:** Gestor (Manager) do Ateliê Sandbox — Aprovado.
- **Cenário C:** Funcionário (Staff) do Ateliê Sandbox — Aprovado.
- **Cenário D:** Usuário com Múltiplos Vínculos (Ateliê e Verde) — Aprovado.
- **Cenário E:** Usuário Autenticado Sem Vínculos — Aprovado.
- **Cenário F:** Administrador Global da Plataforma — Aprovado.
- **Cenário G:** Suspensão Temporária de Empresa e Restauração Imediata — Aprovado.
- **Cenário H:** Ciclo de Vida de Convites e Rejeição de Divergência — Aprovado.

**Resultado da Verificação:** **8/8 cenários aprovados (100% sucesso)**.  
O estado do Sandbox permaneceu limpo e intacto:
- Estabelecimentos Fictícios (2): Ateliê Sandbox (`active`), Verde Sandbox (`active`).
- Usuários Fictícios: 7 usuários com senhas e credenciais preservadas.
- Vínculos Associativos: 6 associações ativas.
- Convites Controlados: 3 registros (`pending`, `expired`, `revoked`).

---

## 19. EVIDÊNCIAS VISUAIS DE HOMOLOGAÇÃO (SCREENSHOTS)

As capturas de tela reais foram salvas em `docs/visual-review/fase-5b/` e copiadas para os artefatos de entrega:

1. `admin-atividades-light.png`: Tela `/admin/atividades` no Light Mode com filtros por empresa e tabela Retail-OS.
2. `admin-atividades-dark.png`: Tela `/admin/atividades` no Dark Mode com listagem completa de eventos da plataforma.
3. `audit-detail-dialog-dark.png`: Modal nativo `<dialog>` aberto com exibição de metadados JSON formatados e higienizados.
4. `dashboard-atividades-owner-light.png`: Tela `/dashboard/atividades` para o Proprietário do Ateliê no Light Mode.
5. `dashboard-atividades-owner-dark.png`: Tela `/dashboard/atividades` no Dark Mode com link visível na navegação lateral.
6. `dashboard-atividades-staff-denied-light.png`: Estado de acesso negado (403) ao acessar diretamente a rota de atividades como `staff`.
7. `dashboard-configuracoes-validacao-light.png`: Formulário de configurações demonstrando validação e suporte a telefones formatados.
8. `dashboard-configuracoes-dark.png`: Painel de configurações no Dark Mode.
9. `dashboard-membros-convites-light.png`: Painel de membros com abas de convites (`Pendentes`, `Expirados / Revogados`) e ação de reenviar.
10. `dashboard-membros-convites-dark.png`: Painel de membros no Dark Mode com diálogo de confirmação de alteração de papel.
11. `mobile-nav-atividades-light.png`: Menu mobile drawer nativo exibindo o link de atividades condicionado por papel.
12. `tenant-suspenso-subrota-light.png`: Bloqueio amigável `SuspendedTenantState` exibido ao tentar acessar sub-rota de empresa suspensa.

---

## 20. DECLARAÇÃO DE ENCERRAMENTO DA FASE 5B

Declaramos que a **Fase 5B — Consolidação operacional, auditoria, configurações empresariais e preparação do Core para produtos comerciais** está **OFICIALMENTE CONCLUÍDA E HOMOLOGADA**.

- Todas as diretrizes arquiteturais foram seguidas.
- Todas as 9 verificações obrigatórias (`check:project`, `check:env`, `typecheck`, `lint`, `test`, `supabase test db`, `sandbox:verify`, `test:e2e`, `build`) foram executadas e aprovadas com 100% de sucesso.
- O Core está pronto, desacoplado e documentado para receber módulos comerciais em fases futuras.
- **NENHUM TRABALHO DA FASE 6 FOI INICIADO.** A plataforma aguarda instruções para os próximos passos.

