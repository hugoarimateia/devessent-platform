# DevEssent Platform — Guia de Preparação para Supabase Cloud

Este documento define o procedimento oficial para provisionar e operar a **DevEssent Platform** no **Supabase Cloud**, preservando integralmente o schema PostgreSQL, RLS, RBAC, Auth, Storage, Auditoria, Rate Limiting e módulo DevEssent Retail.

> **Regra Inegociável:** O Supabase (PostgreSQL 15+) é a única infraestrutura oficial e definitiva da plataforma. O modo XAMPP/MariaDB é exclusivamente para testes locais sem Docker e **nunca** deve ser habilitado em Staging ou Produção.

---

## 1. Separação de Ambientes Cloud

| Ambiente | Finalidade | Dados Permitidos | `AUTHORIZED_SANDBOX_PROJECT_ID` |
|---|---|---|---|
| **Supabase Cloud Staging** | Validação de migrations, Auth (SMTP real), Storage, RLS e QA antes de release | Dados de QA / homologação controlada | Opcional (somente se autorizado explicitamente) |
| **Supabase Cloud Production** | Operação comercial real com empresas e usuários reais | Exclusivamente dados reais de clientes | **NUNCA definir / Proibido executar seeds Sandbox** |

---

## 2. Variáveis de Ambiente Obrigatórias (Cloud)

Configure as variáveis abaixo no provedor de hospedagem (ou `.env.local` temporário apenas para CLI autorizado, nunca versionado):

```dotenv
APP_BACKEND_MODE=supabase
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://app.suaempresa.com.br

NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-server-only>
```

**Regras de Segurança:**
- `SUPABASE_SERVICE_ROLE_KEY` é estritamente `server-only` (nunca prefixar com `NEXT_PUBLIC_`, nunca expor no navegador ou em logs).
- `APP_BACKEND_MODE` deve permanecer `supabase` (em `NODE_ENV=production`, qualquer tentativa de usar `xampp-test` falha fechado imediatamente).

---

## 3. Inventário e Ordem das Migrations Oficiais

Todas as 10 migrations em `supabase/migrations/` foram auditadas quanto à ordem cronológica, idempotência e dependências:

1. `20260301000001_initial_schema.sql` — Extensão `pgcrypto`, enums (`tenant_status`, `membership_role`), `profiles`, `tenants`, `tenant_memberships`, `tenant_settings`, `platform_admins`, triggers `updated_at`.
2. `20260301000002_row_level_security.sql` — Funções auxiliares `is_platform_admin`, `is_tenant_member`, `has_tenant_role` e RLS em todas as tabelas Core.
3. `20260301000003_security_hardening.sql` — `is_tenant_active`, proteção contra auto-promoção a `owner`, restrições em tenants suspensos.
4. `20260301000004_tenant_operations_and_invitations.sql` — `tenant_invitations`, `audit_logs`, fluxo de aceite de convites.
5. `20260301000005_security_audit_hardening.sql` — Hardening de políticas de auditoria e RPCs `SECURITY DEFINER`.
6. `20260301000006_tenant_branding_settings.sql` — Branding dinâmico (`segment_label`, `primary_color`, `monogram`, `brand_description`).
7. `20260301000007_operational_audit_and_rate_limits.sql` — `rate_limits`, RPCs `consume_rate_limit` e `reset_rate_limit`.
8. `20260301000008_retail_module_catalog.sql` — 7 tabelas Retail (`retail_stores`, `retail_categories`, `retail_products`, `retail_product_categories`, `retail_product_options`, `retail_variants`, `retail_product_images`), função `is_retail_active`, RLS e bucket Storage `retail-media`.
9. `20260301000009_performance_indexes_and_rls_stability.sql` — Otimização `STABLE` nas funções de RLS e índices compostos.
10. `20260301000010_retail_storefront_settings.sql` — Configurações de vitrine pública (`slug`, `template`, `brand_headline`, `accent_color`, etc.) e RPC `get_public_storefront`.

---

## 4. Procedimento Seguro de Implantação no Cloud

**Nunca** execute `supabase db reset --remote`. Siga a sequência:

1. **Vincular ao projeto remoto autorizado:**
   ```powershell
   pnpm exec supabase link --project-ref <project-ref>
   ```
2. **Pré-visualizar alterações sem aplicar (Dry-Run):**
   ```powershell
   pnpm exec supabase db push --dry-run
   ```
3. **Aplicar migrations pendentes após revisão:**
   ```powershell
   pnpm exec supabase db push
   ```
4. **Verificar no Painel Supabase Cloud:**
   - **Authentication -> URL Configuration:** adicionar `https://<seu-dominio>/auth/callback` nas *Redirect URLs*.
   - **Storage -> Buckets:** confirmar que o bucket `retail-media` foi criado e que as políticas `retail_media_tenant_*` estão ativas.
   - **Database -> Extensions:** confirmar `pgcrypto` habilitada.
5. **Validar saúde da aplicação:**
   - Executar `pnpm env:check` com as variáveis do ambiente alvo e verificar `/api/health`.

