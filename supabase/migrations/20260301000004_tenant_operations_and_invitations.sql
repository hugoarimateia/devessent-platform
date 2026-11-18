-- ==============================================================================
-- DEVESSENT PLATFORM CORE — MIGRATION 004: TENANT OPERATIONS & INVITATIONS
-- Data: 2026-03-01
-- Descrição: Tabela de convites, funções transacionais de criação atômica
--             de estabelecimentos e proteção do último proprietário.
-- ==============================================================================

-- 1. Tabela: tenant_invitations
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role membership_role NOT NULL DEFAULT 'staff',
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invitation_role_check CHECK (role IN ('manager', 'staff')),
    CONSTRAINT valid_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_invitation
    ON public.tenant_invitations (tenant_id, lower(email))
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.tenant_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.tenant_invitations(lower(email));

CREATE TRIGGER set_tenant_invitations_updated_at
    BEFORE UPDATE ON public.tenant_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 2. Habilitar e forçar RLS em tenant_invitations
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_authorized"
    ON public.tenant_invitations FOR SELECT
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role, 'manager'::membership_role])
        )
        OR (
            lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    );

CREATE POLICY "invitations_insert_authorized"
    ON public.tenant_invitations FOR INSERT
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND (
                (
                    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
                    AND role IN ('manager'::membership_role, 'staff'::membership_role)
                )
                OR
                (
                    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['manager'::membership_role])
                    AND role = 'staff'::membership_role
                )
            )
        )
    );

CREATE POLICY "invitations_update_authorized"
    ON public.tenant_invitations FOR UPDATE
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
            AND status = 'revoked'
        )
    );

CREATE POLICY "invitations_delete_authorized"
    ON public.tenant_invitations FOR DELETE
    USING (
        public.is_platform_admin(auth.uid())
        OR (
            public.is_tenant_active(tenant_id)
            AND public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner'::membership_role])
        )
    );

-- 3. Função transacional atômica para criação de estabelecimento com proprietário
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
    p_name TEXT,
    p_slug TEXT,
    p_owner_user_id UUID,
    p_actor_user_id UUID,
    p_display_name TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT 'America/Sao_Paulo',
    p_locale TEXT DEFAULT 'pt-BR'
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_settings_name TEXT;
    v_owner_email TEXT;
    v_result JSONB;
BEGIN
    -- 1. Autorização rigorosa: apenas platform_admin
    IF NOT public.is_platform_admin(p_actor_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: operação restrita a administradores da plataforma.';
    END IF;

    -- 2. Validar que o proprietário indicado existe na tabela profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_user_id) THEN
        RAISE EXCEPTION 'Proprietário inválido: usuário não encontrado.';
    END IF;

    -- 3. Inserir o estabelecimento
    INSERT INTO public.tenants (name, slug, status)
    VALUES (p_name, p_slug, 'active')
    RETURNING id INTO v_tenant_id;

    -- 4. Vincular o proprietário inicial
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_owner_user_id, 'owner');

    -- 5. Criar configurações iniciais herdando o e-mail do proprietário
    SELECT email INTO v_owner_email FROM auth.users WHERE id = p_owner_user_id;
    v_settings_name := COALESCE(NULLIF(p_display_name, ''), p_name);
    INSERT INTO public.tenant_settings (tenant_id, display_name, contact_email, timezone, locale)
    VALUES (v_tenant_id, v_settings_name, v_owner_email, p_timezone, p_locale);

    -- 6. Gravar auditoria imutável
    INSERT INTO public.audit_logs (
        tenant_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
    )
    VALUES (
        v_tenant_id,
        p_actor_user_id,
        'tenant.created',
        'tenant',
        v_tenant_id::text,
        jsonb_build_object(
            'name', p_name,
            'slug', p_slug,
            'owner_user_id', p_owner_user_id
        )
    );

    v_result := jsonb_build_object(
        'id', v_tenant_id,
        'name', p_name,
        'slug', p_slug,
        'status', 'active',
        'owner_user_id', p_owner_user_id
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Função transacional atômica para aceitar convite de membro
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
    p_token_hash TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
BEGIN
    -- 1. Validar que o usuário autenticado corresponde ao parâmetro
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Acesso negado: identidade não autenticada ou divergente.';
    END IF;

    -- Obter e-mail autenticado do token JWT
    v_user_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_user_email = '' THEN
        RAISE EXCEPTION 'Não foi possível resolver o e-mail da sessão atual.';
    END IF;

    -- 2. Localizar o convite pendente e não expirado
    SELECT * INTO v_invitation
    FROM public.tenant_invitations
    WHERE token_hash = p_token_hash
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado ou já processado.';
    END IF;

    IF v_invitation.expires_at <= now() THEN
        UPDATE public.tenant_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
        RAISE EXCEPTION 'Este convite expirou.';
    END IF;

    -- 3. Validar se o e-mail do convite coincide exatamente com o e-mail autenticado
    IF lower(v_invitation.email) != v_user_email THEN
        RAISE EXCEPTION 'Este convite foi emitido para outro endereço de e-mail.';
    END IF;

    -- 4. Validar se a empresa está ativa
    IF NOT public.is_tenant_active(v_invitation.tenant_id) THEN
        RAISE EXCEPTION 'O estabelecimento convidante está inativo ou suspenso.';
    END IF;

    -- 5. Inserir ou atualizar a membership
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_invitation.tenant_id, p_user_id, v_invitation.role)
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, updated_at = now();

    -- 6. Marcar o convite como aceito
    UPDATE public.tenant_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = v_invitation.id;

    -- 7. Registrar auditoria
    INSERT INTO public.audit_logs (
        tenant_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
    )
    VALUES (
        v_invitation.tenant_id,
        p_user_id,
        'invitation.accepted',
        'tenant_membership',
        v_invitation.id::text,
        jsonb_build_object(
            'role', v_invitation.role,
            'email', v_invitation.email,
            'invited_by', v_invitation.invited_by
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', v_invitation.tenant_id,
        'role', v_invitation.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) TO authenticated;

-- 5. Trigger de proteção: Impedir remoção ou rebaixamento do último proprietário
CREATE OR REPLACE FUNCTION public.check_last_tenant_owner()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_count INTEGER;
BEGIN
    IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role != 'owner') THEN
        SELECT count(*) INTO v_owner_count
        FROM public.tenant_memberships
        WHERE tenant_id = OLD.tenant_id
          AND role = 'owner'
          AND user_id != OLD.user_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Operação negada: o estabelecimento não pode ficar sem nenhum proprietário.';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_check_last_owner ON public.tenant_memberships;
CREATE TRIGGER trigger_check_last_owner
    BEFORE DELETE OR UPDATE ON public.tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.check_last_tenant_owner();

