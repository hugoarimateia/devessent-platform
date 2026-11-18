# DevEssent Platform — Contrato Arquitetural de Módulos Comerciais

## 1. Visão Geral
Este diretório destina-se a abrigar os futuros produtos verticais da DevEssent (como Retail, Booking, Service e CRM).

> [!IMPORTANT]
> **Na presente fase de fundação (Core até Fase 5B), nenhum módulo comercial é implementado.**
> O `src/core/` provê a fundação compartilhada de autenticação, identidade multiempresa, RBAC, auditoria, configurações, segurança anti-abuso e Design System. O Core nunca deve importar código de módulos comerciais.

---

## 2. Contrato Real de Integração (Core APIs)

Consulte o guia completo em [docs/vertical-integration-guide.md](../../docs/vertical-integration-guide.md). Todo produto vertical desenvolvido futuramente dentro de `src/modules/<modulo>` deve consumir as APIs oficiais do Core abaixo:

### 2.1. Autenticação e Identidade do Usuário
```typescript
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";

const supabase = await createClient();
const sessionUser = await AuthService.requireSessionUser(supabase);
// sessionUser.id, sessionUser.email, sessionUser.fullName, sessionUser.isPlatformAdmin
```

### 2.2. Resolução do Estabelecimento Ativo (`tenant_id`)
Todo caso de uso de módulo deve resolver o contexto ativo exclusivamente no servidor:
```typescript
import { TenantService } from "@/core/tenants";

const context = await TenantService.resolveTenantContext(
  supabase,
  sessionUser.id,
  selectedTenantIdOrSlug
);
// Garante pertencimento ao tenant, status != 'suspended' e retorna context.tenantId e context.role
```
O módulo nunca deve confiar em `tenant_id` enviado pelo cliente sem passar por `TenantService.resolveTenantContext`.

### 2.3. Verificação de Autorização (RBAC)
```typescript
import { PermissionService } from "@/core/permissions/services/permission-service";

PermissionService.assertPermission(context.role, "view_workspace");
```
Novas operações específicas do módulo vertical deverão estender o contrato de permissões com checagem no servidor e políticas correspondentes em RLS.

### 2.4. Persistência de Dados e RLS
- Toda tabela criada por um módulo futuro deve possuir coluna `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`.
- Habilitar obrigatoriamente `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` utilizando `public.is_tenant_active(tenant_id)` e `public.is_tenant_member(tenant_id, auth.uid())` / `public.has_tenant_role(...)`.

### 2.5. Auditoria Estruturada
Operações comerciais sensíveis devem emitir eventos via `AuditService`, com higienização profunda automática de metadados:
```typescript
import { AuditService } from "@/core/audit";

await AuditService.recordEvent({
  supabase,
  tenantId: context.tenantId,
  actorUserId: context.userId,
  action: "module_event.executed",
  resourceType: "module_resource",
  resourceId,
  metadata: { summaryDetail: "valor seguro" },
});
```

### 2.6. Interface e Design System
Páginas de módulos verticais devem montar sua interface dentro de `<AppShell>`, reutilizando `<PageHeader>`, `<DataTable>`, `<StatusBadge>`, `<RoleBadge>`, `<ConfirmationDialog>` e os tokens CSS dinâmicos do tenant (`--t-ink`, `--t-fill`, `--t-tint`, `--t-badge-bg`, `--t-border`) injetados automaticamente pelo Core em Light e Dark mode.

### 2.7. Isolamento de Sandbox e Testes
- É proibido importar ou referenciar qualquer slug/arquivo de `sandbox-data/` dentro de `src/`.
- Cada módulo vertical manterá sua própria suíte de testes unitários, integração RLS real e E2E sem alterar a integridade das migrations e testes do Core.
