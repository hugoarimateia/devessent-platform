-- ==============================================================================
-- DEVESSENT PLATFORM CORE — MIGRATION 003: SECURITY HARDENING & AUDIT REFINEMENTS
-- Data: 2026-03-01
-- Descrição: Endurecimento de funções SECURITY DEFINER, tratamento rigoroso
--             de valores nulos, proteção de suspensão multiempresa em todas
--             as tabelas operacionais e blindagem contra escalonamento de owner.
-- ==============================================================================

-- 1. Reforço de segurança das funções auxiliares (Null Safety e Search Path)
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_tenant_active(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE id = check_tenant_id
          AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_tenant_member(check_tenant_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL OR check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

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
    IF check_tenant_id IS NULL OR check_user_id IS NULL OR allowed_roles IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.tenant_memberships
        WHERE tenant_id = check_tenant_id
          AND user_id = check_user_id
          AND role = ANY(allowed_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Revogar privilégios de execução direta de triggers do PUBLIC e anon
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon;

-- 3. Atualizar políticas de tenant_settings para respeitar suspensão da empresa
DROP POLICY IF EXISTS "settings_select_members_or_admin" ON public.tenant_settings;
CREATE POLICY "settings_select_members_or_admin"
    ON public.tenant_settings FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.is_tenant_member(tenant_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "settings_update_owner_or_manager_or_admin" ON public.tenant_settings;
CREATE POLICY "settings_update_owner_or_manager_or_admin"
    ON public.tenant_settings FOR UPDATE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
        )
    );

-- 4. Atualizar políticas de tenant_memberships para blindar contra atribuição de owner
--    e respeitar status suspenso da empresa
DROP POLICY IF EXISTS "memberships_select_tenant_members_or_admin" ON public.tenant_memberships;
CREATE POLICY "memberships_select_tenant_members_or_admin"
    ON public.tenant_memberships FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.is_tenant_member(tenant_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "memberships_insert_authorized" ON public.tenant_memberships;
CREATE POLICY "memberships_insert_authorized"
    ON public.tenant_memberships FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND (
                -- Owner pode adicionar manager e staff (NÃO outro owner)
                (
                    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
                    AND role IN ('manager'::membership_role, 'staff'::membership_role)
                )
                OR
                -- Manager pode adicionar apenas staff
                (
                    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['manager'::membership_role])
                    AND role = 'staff'::membership_role
                )
            )
        )
    );

DROP POLICY IF EXISTS "memberships_update_owner_or_admin" ON public.tenant_memberships;
CREATE POLICY "memberships_update_owner_or_admin"
    ON public.tenant_memberships FOR UPDATE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid()
            -- Blindagem: Proprietário NÃO pode promover ninguém a Owner no fluxo padrão
            AND role IN ('manager'::membership_role, 'staff'::membership_role)
        )
    );

DROP POLICY IF EXISTS "memberships_delete_owner_or_admin" ON public.tenant_memberships;
CREATE POLICY "memberships_delete_owner_or_admin"
    ON public.tenant_memberships FOR DELETE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
            AND user_id != auth.uid()
        )
    );

-- 5. Atualizar políticas de audit_logs para respeitar suspensão da empresa
DROP POLICY IF EXISTS "audit_logs_select_authorized" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authorized"
    ON public.audit_logs FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            tenant_id IS NOT NULL
            AND public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
        )
    );

DROP POLICY IF EXISTS "audit_logs_insert_authorized" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authorized"
    ON public.audit_logs FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            tenant_id IS NOT NULL
            AND public.is_tenant_active(tenant_id)
            AND public.is_tenant_member(tenant_id, auth.uid())
        )
    );

