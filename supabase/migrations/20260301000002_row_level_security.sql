-- ==============================================================================
-- DEVESSENT PLATFORM CORE — MIGRATION 002: ROW-LEVEL SECURITY (RLS)
-- Data: 2026-03-01
-- Descrição: Políticas estritas de RLS e funções de verificação com princípio
--             de negação por padrão (Fail-Closed).
-- ==============================================================================

-- 1. Habilitar e forçar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 2. Funções auxiliares de checagem com SECURITY DEFINER e search_path restrito
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_tenant_member(check_tenant_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.tenant_memberships
        WHERE tenant_id = check_tenant_id
          AND user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_tenant_role(
    check_tenant_id UUID,
    check_user_id UUID,
    allowed_roles membership_role[]
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.tenant_memberships
        WHERE tenant_id = check_tenant_id
          AND user_id = check_user_id
          AND role = ANY(allowed_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Políticas para: profiles
CREATE POLICY "profiles_select_own_or_member_or_admin"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR public.is_platform_admin(auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.tenant_memberships tm_current
            JOIN public.tenant_memberships tm_target
              ON tm_current.tenant_id = tm_target.tenant_id
            WHERE tm_current.user_id = auth.uid()
              AND tm_target.user_id = public.profiles.id
        )
    );

CREATE POLICY "profiles_update_own_or_admin"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR public.is_platform_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id
        OR public.is_platform_admin(auth.uid())
    );

-- 4. Políticas para: tenants
CREATE POLICY "tenants_select_authorized"
    ON public.tenants FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (status = 'active' AND public.is_tenant_member(id, auth.uid()))
    );

CREATE POLICY "tenants_insert_platform_admin_only"
    ON public.tenants FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
    );

CREATE POLICY "tenants_update_owner_or_platform_admin"
    ON public.tenants FOR UPDATE
    USING (
        public.is_platform_admin(auth.uid())
        OR (status = 'active' AND public.has_tenant_role(id, auth.uid(), ARRAY['owner'::membership_role]))
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (status = 'active' AND public.has_tenant_role(id, auth.uid(), ARRAY['owner'::membership_role]))
    );

CREATE POLICY "tenants_delete_platform_admin_only"
    ON public.tenants FOR DELETE
    USING (
        public.is_platform_admin(auth.uid())
    );

-- 5. Políticas para: tenant_memberships
CREATE POLICY "memberships_select_tenant_members_or_admin"
    ON public.tenant_memberships FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_tenant_member(tenant_id, auth.uid())
    );

CREATE POLICY "memberships_insert_authorized"
    ON public.tenant_memberships FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            -- Owner pode adicionar manager e staff
            public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND role IN ('manager'::membership_role, 'staff'::membership_role)
        )
        OR (
            -- Manager pode adicionar apenas staff
            public.has_tenant_role(tenant_id, auth.uid(), ARRAY['manager'::membership_role])
            AND role = 'staff'::membership_role
        )
    );

CREATE POLICY "memberships_update_owner_or_admin"
    ON public.tenant_memberships FOR UPDATE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid() -- Impede auto-modificação de papel para prevenir perda acidental de controle
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid()
        )
    );

CREATE POLICY "memberships_delete_owner_or_admin"
    ON public.tenant_memberships FOR DELETE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid()
        )
    );

-- 6. Políticas para: tenant_settings
CREATE POLICY "settings_select_members_or_admin"
    ON public.tenant_settings FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_tenant_member(tenant_id, auth.uid())
    );

CREATE POLICY "settings_insert_admin_or_owner"
    ON public.tenant_settings FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
    );

CREATE POLICY "settings_update_owner_or_manager_or_admin"
    ON public.tenant_settings FOR UPDATE
    USING (
        public.is_platform_admin(auth.uid())
        OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
    );

-- 7. Políticas para: platform_admins
-- Somente platform admins podem ver quem são platform admins; mutação via client é vedada
CREATE POLICY "platform_admins_select_admins_only"
    ON public.platform_admins FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
    );

-- 8. Políticas para: audit_logs
CREATE POLICY "audit_logs_select_authorized"
    ON public.audit_logs FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            tenant_id IS NOT NULL
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
        )
    );

CREATE POLICY "audit_logs_insert_authorized"
    ON public.audit_logs FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            tenant_id IS NOT NULL
            AND public.is_tenant_member(tenant_id, auth.uid())
        )
    );

-- Logs são estritamente imutáveis: não há policies de UPDATE ou DELETE para audit_logs

