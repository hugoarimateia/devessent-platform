# DevEssent Platform — Guia de Integração para Futuros Produtos Verticais

Este documento descreve o contrato técnico entre o **DevEssent Platform Core** (consolidado na Fase 5B) e futuros produtos verticais comerciais (ex.: Retail, Booking, Service, CRM).

> [!NOTE]
> Nenhuma regra comercial específica reside no Core. O Core entrega toda a camada transversal auditada de identidade, multiempresa, RBAC, auditoria, configurações, temas dinâmicos e proteção contra abuso.

---

## 1. Camada de Autenticação e Sessão SSR

- **Fonte única:** Supabase Auth via cookies SSR gerenciados por `src/lib/supabase/middleware.ts` e `src/lib/supabase/server.ts`.
- **Consumo em Server Components, Route Handlers e Server Actions:**
  - `AuthService.getSessionUser(supabase)` retorna `SessionUser | null`.
  - `AuthService.requireSessionUser(supabase)` lança `UnauthorizedError` se não houver sessão válida.
- **Regras:**
  - Nunca criar sessão paralela nem confiar apenas no cliente.
  - Sempre utilizar o cliente SSR (`createClient()`) para respeitar Row-Level Security do PostgreSQL.
  - Utilizar `createAdminClient()` (`service_role`) somente em fluxos privilegiados devidamente autorizados no servidor e nunca expor sua chave ao cliente.

---

## 2. Identidade do Usuário e Contexto Ativo da Empresa (`tenant_id`)

- A identidade global do usuário fica em `auth.users` sincronizada com `public.profiles(id, full_name, avatar_url)`.
- Administradores globais são identificados em `public.platform_admins(user_id)`.
- A seleção do estabelecimento ativo no Workspace é persistida pelo cookie HTTP-only `devessent_active_tenant`.
- **Regra obrigatória de resolução:**
  ```typescript
  const userTenants = await TenantService.listUserTenants(supabase, sessionUser.id);
  const activeContext = await TenantService.resolveTenantContext(
    supabase,
    sessionUser.id,
    selectedTenantId
  );
  ```
- **O que `resolveTenantContext` garante no servidor:**
  1. Usuário pertence ao estabelecimento (ou é `platform_admin`).
  2. Estabelecimento não está suspenso (lançando `TenantSuspendedError`, tratado na UI por `<SuspendedTenantState />`).
  3. Papel exato (`platform_admin | owner | manager | staff`) resolvido do banco, nunca de cookie/formulário do cliente.

---

## 3. Permissões (RBAC) e Isolamento em Banco (PostgreSQL RLS)

- **Aplicação:** `PermissionService.assertPermission(context.role, operation, targetRole?)` e matriz central em `src/core/permissions/policies/role-matrix.ts`.
- **Banco de Dados:** Toda nova tabela vertical deve:
  - Referenciar `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`.
  - Ativar `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`.
  - Utilizar as funções `SECURITY DEFINER` com `SET search_path = public`:
    - `public.is_platform_admin(auth.uid())`
    - `public.is_tenant_active(tenant_id)`
    - `public.is_tenant_member(tenant_id, auth.uid())`
    - `public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'manager']::membership_role[])`

---

## 4. Auditoria Estruturada (`AuditService`)

- **Escrita segura:** `AuditService.recordEvent({ supabase, tenantId, actorUserId, action, resourceType, resourceId, metadata })` sanitiza recursivamente metadados (`sanitizeMetadata`), removendo qualquer campo ou padrão sensível (`password`, `token`, `token_hash`, `secret`, `apiKey`, `serviceRole`, `jwt`, `cookie`, `recovery`).
- **Leitura com escopo RBAC:**
  - `AuditService.listPlatformAuditLogs`: exclusivo para `platform_admin` (`/admin/atividades`).
  - `AuditService.listTenantAuditLogs`: impõe escopo de `tenant_id` via RLS + matriz RBAC (`owner` vê todos os eventos da unidade; `manager` vê somente eventos operacionais autorizados em `MANAGER_VISIBLE_AUDIT_ACTIONS`; `staff` recebe `ForbiddenError`).
- **Extensão:** Ao criar novos eventos em produtos verticais, registre rótulos descritivos no catálogo de auditoria e nunca grave URLs com tokens, senhas ou dados pessoais sensíveis no JSON de metadados.

---

## 5. Configurações e Identidade Visual Dinâmica (`tenant_settings` + Design System)

- **Leitura/Atualização:** `TenantService.getSettings(supabase, activeContext)` e `TenantService.updateSettings(...)`.
- **Identidade visual por estabelecimento:** `resolveTenantBrand(...)` converte `primary_color`, `segment_label`, `monogram`, `display_name` e `brand_description` em tokens CSS aplicados automaticamente pelo `<AppShell>`:
  - `--t-ink` (cor acessível em Light e Dark Mode)
  - `--t-fill`, `--t-tint`, `--t-badge-bg`, `--t-badge-text`, `--t-border`
- **Componentes reutilizáveis obrigatórios para novos módulos:**
  - Layout: `AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `MobileNavigation`, `Breadcrumbs`
  - Feedback & Estados: `AlertBanner`, `ConfirmationDialog`, `EmptyState`, `AccessDeniedState`, `SuspendedTenantState`, `StatusBadge`, `RoleBadge`
  - Dados & Formulários: `DataTable` (`embedded` para painéis unificados), `SearchInput`, `Input`, `Select`, `Textarea`, `Button`, `Label`
  - Auditoria: `AuditLogViewer`
  - Temas: Light Mode, Dark Mode e Sistema gerenciados por `ThemeProvider` sem FOUC.

---

## 6. Segurança Anti-Abuso, Erros Públicos e Isolamento

- **Normalização de erros:** Use `toPublicErrorMessage(err, fallback)` em `src/core/errors/public-error.ts` em todas as Server Actions e Route Handlers para nunca expor códigos SQLSTATE, nomes de constraints ou mensagens internas do PostgREST.
- **Rate Limit / Anti-Abuso:**
  - *Supabase Auth (GoTrue):* Proteção nativa para envio de e-mails de recuperação e endpoints de autenticação.
  - *PostgreSQL (`public.rate_limits` + `RateLimitService`):* Controle atômico com row locking (`consume_rate_limit`) para tentativas falhas de login, solicitações de recuperação, criação/aceite de convites e operações administrativas de tenants.
- **Regra absoluta de isolamento:** Nenhum código em `src/` pode importar arquivos de `sandbox-data/` ou hardcodar identificadores de empresas fictícias. Esta regra é verificada continuamente por `pnpm check:project`.

