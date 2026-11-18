-- Fase de Otimização de Performance Local:
-- 1. Marcar funções auxiliares de RLS puramente de leitura como STABLE
--    para permitir InitPlan caching pelo planejador do PostgreSQL em vez de reavaliação por linha.
ALTER FUNCTION public.is_platform_admin(UUID) STABLE;
ALTER FUNCTION public.is_tenant_member(UUID, UUID) STABLE;
ALTER FUNCTION public.has_tenant_role(UUID, UUID, public.membership_role[]) STABLE;
ALTER FUNCTION public.is_tenant_active(UUID) STABLE;

-- 2. Índices compostos adicionais para padrões frequentes de filtro e ordenação
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_status_created
  ON public.tenant_invitations (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memberships_role_tenant
  ON public.tenant_memberships (role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_retail_variants_product_sort
  ON public.retail_variants (product_id, sort_order);

-- 3. Atualizar estatísticas do otimizador em todas as tabelas públicas
ANALYZE public.profiles;
ANALYZE public.platform_admins;
ANALYZE public.tenants;
ANALYZE public.tenant_settings;
ANALYZE public.tenant_memberships;
ANALYZE public.tenant_invitations;
ANALYZE public.audit_logs;
ANALYZE public.rate_limits;
ANALYZE public.retail_stores;
ANALYZE public.retail_categories;
ANALYZE public.retail_products;
ANALYZE public.retail_product_categories;
ANALYZE public.retail_product_options;
ANALYZE public.retail_variants;
ANALYZE public.retail_product_images;

