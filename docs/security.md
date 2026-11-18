# DevEssent Platform — Arquitetura de Segurança

## 1. Princípios de Segurança
- **Negação por Padrão (Fail-Closed):** Sem autorização explícita, o acesso a qualquer dado ou rota é sumariamente negado.
- **Defesa em Profundidade:** A segurança é aplicada na camada de aplicação (TypeScript/Zod/RBAC) e no nível do banco de dados (Row-Level Security no PostgreSQL).
- **Isolamento Absoluto Multiempresa:** Nenhum usuário comum de uma empresa consegue ler, alterar ou deduzir a existência de dados de outra empresa.
- **Proteção contra Escalonamento de Privilégios:** Membros não podem alterar o próprio papel nem associar-se arbitrariamente a estabelecimentos alheios.
- **Isolamento de Credenciais:** As chaves de serviço (`SUPABASE_SERVICE_ROLE_KEY`) nunca são expostas ao navegador.
- **Mensagens Amigáveis e Higienização de Erros:** Exceções de PostgreSQL/PostgREST são normalizadas por `toPublicErrorMessage` (`src/core/errors/public-error.ts`) para evitar vazamento de schema, constraints ou detalhes internos.

---

## 2. Matriz de Permissões (RBAC)

| Operação | Platform Admin | Owner | Manager | Staff |
|---|:---:|:---:|:---:|:---:|
| Criar empresa (`create_tenant`) | **Sim** | Não | Não | Não |
| Administrar qualquer empresa (`manage_any_tenant`) | **Sim** | Não | Não | Não |
| Visualizar a própria empresa (`view_own_tenant`) | **Sim** | **Sim** | **Sim** | **Sim** |
| Alterar configurações gerais (`update_general_settings`) | **Sim** | **Sim** | **Sim** | Não |
| Gerenciar membros (`manage_members`) | **Sim** | **Sim** | Limitado (Staff) | Não |
| Emitir/revogar convites (`invite_member` / `revoke_invitation`) | **Sim** | **Sim** (Manager/Staff) | Limitado (Staff) | Não |
| Visualizar auditoria do tenant (`view_tenant_audit_logs`) | **Sim** | **Sim** | Operacional | Não |
| Visualizar auditoria global (`view_platform_audit_logs`) | **Sim** | Não | Não | Não |
| Alterar o proprietário (`change_owner`) | Proc. Especial | Proc. Especial | Não | Não |
| Visualizar área de trabalho (`view_workspace`) | **Sim** | **Sim** | **Sim** | **Sim** |
| Suspender / reativar empresa (`suspend_tenant`) | **Sim** | Não | Não | Não |

### Escopo de Auditoria para `manager` vs `owner`
- `owner` e `platform_admin` consultam todos os eventos pertencentes ao estabelecimento (incluindo criação, suspensão e reativação).
- `manager` consulta apenas eventos operacionais previstos em `MANAGER_VISIBLE_AUDIT_ACTIONS` (`tenant_settings.updated`, `invitation.*`, `member.*`), sem visibilidade a eventos de governança de plataforma ou de outros estabelecimentos.
- `staff` tem `view_tenant_audit_logs` negado no serviço, nas consultas SQL sob RLS e na navegação UI.

---

## 3. Políticas de Row-Level Security (RLS)

Todas as tabelas do schema público possuem RLS habilitado com `FORCE ROW LEVEL SECURITY`.

Funções auxiliares de checagem utilizam `SECURITY DEFINER` e `SET search_path = public` para prevenir SQL injection e privilege escalation:
- `is_platform_admin(auth.uid())`
- `get_user_membership(tenant_id, auth.uid())`
- `is_tenant_member(tenant_id, auth.uid())`
- `has_tenant_role(tenant_id, auth.uid(), roles)`
- `is_tenant_active(tenant_id)`

---

## 4. Auditoria Profunda & Proteção contra Vazamento de Dados

- `AuditService.sanitizeMetadata` (`src/core/audit/services/audit-service.ts`) aplica higienização recursiva tanto na gravação (`recordEvent`) quanto na leitura/visualização (`listPlatformAuditLogs` / `listTenantAuditLogs`), removendo chaves sensíveis (`password`, `token`, `token_hash`, `secret`, `apiKey`, `serviceRole`, `jwt`, `cookie`, `recovery`, `authorization`, `credential`) e mascarando padrões de JWT ou links de convite com tokens.

---

## 5. Proteção Anti-Abuso e Rate Limiting (Camadas Distintas)

A proteção contra força bruta e abuso opera em duas camadas complementares:

1. **Proteção nativa do Supabase Auth (GoTrue):**
   - Limite de cadência para envio de e-mails de recuperação e validações de token nativas do servidor Auth local (`supabase/config.toml`).
2. **Proteção durável da aplicação em PostgreSQL (`public.rate_limits` + `RateLimitService`):**
   - Identificadores são armazenados exclusivamente após hash SHA-256 (`identifier`), sem guardar e-mails ou tokens em claro.
   - Controle atômico via função SQL `public.consume_rate_limit` (`FOR UPDATE` e `SECURITY DEFINER`, restrita exclusivamente a `service_role`):
     - Falhas repetidas de login (`auth:login_failure`, redefinido em login bem-sucedido)
     - Solicitações repetidas de recuperação de senha (`auth:forgot_password`)
     - Emissão em massa de convites (`tenant:invitation_create`, complementado pelo índice único parcial `idx_unique_active_invitation`)
     - Tentativas repetidas de aceite de convite (`tenant:invitation_accept`)
     - Operações administrativas sequenciais de tenants (`admin:tenant_operation`)
