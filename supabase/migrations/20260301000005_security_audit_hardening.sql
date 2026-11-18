-- ==============================================================================
-- DEVESSENT PLATFORM CORE — MIGRATION 005: SECURITY AUDIT HARDENING & RPC SHIELDING
-- Data: 2026-03-01
-- Descrição: Endurecimento rigoroso das funções RPC, prevenção contra spoofing
--             de identificador de administrador, revogação de privilégios de execução
--             de rotinas administrativas para papéis comuns e blindagem contra
--             enumeração de identidades privilegiadas.
-- ==============================================================================

-- 1. Blindagem de funções auxiliares contra enumeração de identidades:
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Se invocado via API PostgREST por anon, rejeitar enumeração
    IF auth.role() = 'anon' THEN
        RETURN FALSE;
    END IF;

    -- Se invocado via API por um usuário autenticado que está consultando OUTRO usuário:
    -- Só permite se o próprio chamador autenticado for platform admin.
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != check_user_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Para o próprio usuário (auth.uid() = check_user_id) ou chamadas do backend (postgres/service_role)
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
    IF check_tenant_id IS NULL OR check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF auth.role() = 'anon' THEN
        RETURN FALSE;
    END IF;

    -- Se o chamador consultar o vínculo de OUTRO usuário,
    -- só permite se o chamador for platform admin OU se pertencer a esse mesmo estabelecimento.
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != check_user_id THEN
        IF NOT (
            EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.tenant_memberships
                WHERE tenant_id = check_tenant_id AND user_id = auth.uid()
            )
        ) THEN
            RETURN FALSE;
        END IF;
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

    IF auth.role() = 'anon' THEN
        RETURN FALSE;
    END IF;

    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != check_user_id THEN
        IF NOT (
            EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.tenant_memberships
                WHERE tenant_id = check_tenant_id AND user_id = auth.uid()
            )
        ) THEN
            RETURN FALSE;
        END IF;
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

-- 2. Endurecimento de create_tenant_with_owner:
--    - Bloqueia execução por authenticated, anon e PUBLIC.
--    - Exige privilégio de service_role.
--    - Valida que auth.uid() coincide com p_actor_user_id quando executado em sessão.
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
    -- 1. Autorização rigorosa e prevenção contra spoofing de identidade:
    -- Se invocado com contexto de sessão JWT (auth.role() = 'authenticated'):
    -- a identidade autenticada NÃO PODE divergir de p_actor_user_id e DEVE ser platform_admin.
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL THEN
        IF auth.uid() != p_actor_user_id OR NOT public.is_platform_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Acesso negado: identidade autenticada não possui privilégios de administrador da plataforma.';
        END IF;
    ELSE
        -- Invocação via service_role ou psql interno: validar que o ator indicado é platform_admin
        IF NOT public.is_platform_admin(p_actor_user_id) THEN
            RAISE EXCEPTION 'Acesso negado: operação restrita a administradores da plataforma.';
        END IF;
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
REVOKE EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- 3. Endurecimento de accept_tenant_invitation:
--    - Valida e-mail estritamente confirmado na auth.
--    - Impede memberships duplicadas e rebaixamento/elevação acidental de papéis.
--    - Mantém lock FOR UPDATE para concorrência segura.
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
    p_token_hash TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
    v_is_email_verified BOOLEAN;
BEGIN
    -- 1. Validar que o usuário autenticado corresponde ao parâmetro
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Acesso negado: identidade não autenticada ou divergente.';
    END IF;

    -- 2. Validar que o e-mail do usuário está devidamente confirmado no Supabase Auth
    SELECT (email_confirmed_at IS NOT NULL) INTO v_is_email_verified
    FROM auth.users
    WHERE id = auth.uid();

    IF NOT COALESCE(v_is_email_verified, FALSE) THEN
        RAISE EXCEPTION 'Acesso negado: o e-mail da sua conta ainda não foi verificado.';
    END IF;

    -- Obter e-mail autenticado do token JWT
    v_user_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_user_email = '' THEN
        RAISE EXCEPTION 'Não foi possível resolver o e-mail da sessão atual.';
    END IF;

    -- 3. Localizar o convite pendente e não expirado com lock FOR UPDATE para evitar concorrência
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

    -- 4. Validar se o e-mail do convite coincide exatamente com o e-mail autenticado
    IF lower(v_invitation.email) != v_user_email THEN
        RAISE EXCEPTION 'Este convite foi emitido para outro endereço de e-mail.';
    END IF;

    -- 5. Validar se a empresa está ativa
    IF NOT public.is_tenant_active(v_invitation.tenant_id) THEN
        RAISE EXCEPTION 'O estabelecimento convidante está inativo ou suspenso.';
    END IF;

    -- 6. Impedir memberships duplicadas ou adulteração de vínculo existente
    IF EXISTS (
        SELECT 1
        FROM public.tenant_memberships
        WHERE tenant_id = v_invitation.tenant_id
          AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Operação negada: usuário já possui vínculo com este estabelecimento.';
    END IF;

    -- 7. Inserir a nova membership
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_invitation.tenant_id, p_user_id, v_invitation.role);

    -- 8. Marcar o convite como aceito
    UPDATE public.tenant_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = v_invitation.id;

    -- 9. Registrar auditoria imutável
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
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) TO service_role;

-- 4. Trigger do último proprietário: permitir exclusão por cascata quando o próprio tenant for deletado
CREATE OR REPLACE FUNCTION public.check_last_tenant_owner()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_count INTEGER;
BEGIN
    -- Permitir exclusão em cascata se o próprio tenant estiver sendo excluído
    IF TG_OP = 'DELETE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id) THEN
            RETURN OLD;
        END IF;
    END IF;

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

REVOKE EXECUTE ON FUNCTION public.check_last_tenant_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_last_tenant_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_last_tenant_owner() FROM authenticated;
