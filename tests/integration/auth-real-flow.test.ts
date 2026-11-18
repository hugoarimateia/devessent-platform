import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthService } from "@/core/auth/services/auth-service";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/environment/env";

describe("Real Integration Suite — Supabase Auth & Session Flow", () => {
  const testUserEmail = `integ.test.${Date.now()}@devessent.test`;
  const testUserPassword = "SenhaSeguraDeTeste123!";
  let testUserId: string;

  // Cliente browser-like (com anon key) para simular o cliente real
  const publicClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  beforeAll(async () => {
    const admin = createAdminClient();

    // Provisionar usuário legítimo de teste no Supabase local
    const { data: userAuth, error } = await admin.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Usuário Integração Real",
      },
    });

    if (error || !userAuth.user) {
      throw new Error(`Falha no setup de usuário de teste: ${error?.message}`);
    }

    testUserId = userAuth.user.id;
  });

  afterAll(async () => {
    const admin = createAdminClient();
    if (testUserId) {
      await admin.auth.admin.deleteUser(testUserId);
    }
  });

  it("1. Deve autenticar com credenciais corretas e retornar sessão válida", async () => {
    const result = await AuthService.signInWithPassword(publicClient, {
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUserEmail);
      expect(result.session.access_token).toBeDefined();
    }
  });

  it("2. Deve rejeitar senha incorreta com mensagem amigável sem vazar detalhes", async () => {
    const result = await AuthService.signInWithPassword(publicClient, {
      email: testUserEmail,
      password: "SenhaCompletamenteIncorreta999!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("E-mail ou senha incorretos");
    }
  });

  it("3. Deve rejeitar e-mail inexistente com a mesma mensagem padronizada", async () => {
    const result = await AuthService.signInWithPassword(publicClient, {
      email: "inexistente.fantasma@devessent.test",
      password: "QualquerSenha123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("E-mail ou senha incorretos");
    }
  });

  it("4. Deve confirmar a sincronização automática entre auth.users e public.profiles", async () => {
    const admin = createAdminClient();

    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", testUserId)
      .single();

    expect(error).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(testUserId);
    expect(profile!.full_name).toBe("Usuário Integração Real");
  });

  it("5. Deve confirmar que usuário comum NÃO possui privilégios de platform_admin", async () => {
    const admin = createAdminClient();

    const { data: adminRecord } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", testUserId)
      .maybeSingle();

    expect(adminRecord).toBeNull();
  });

  it("6. Deve executar o fluxo completo de recuperação e redefinição de senha com validação no Mailpit", async () => {
    const newPassword = "NovaSenhaForteSegura999!";

    // 1. Solicitação de recuperação de senha
    const resetResult = await AuthService.sendPasswordResetEmail(publicClient, testUserEmail);
    expect(resetResult.success).toBe(true);

    // 2. Aguardar e capturar e-mail no Mailpit
    await new Promise((resolve) => setTimeout(resolve, 800));
    const messagesRes = await fetch("http://127.0.0.1:54324/api/v1/messages");
    expect(messagesRes.ok).toBe(true);
    const messagesData = await messagesRes.json();
    const mail = messagesData.messages?.find((m: { To: Array<{ Address: string }> }) =>
      m.To?.some((t) => t.Address.toLowerCase() === testUserEmail.toLowerCase())
    );
    expect(mail).toBeDefined();

    // 3. Obter o corpo do e-mail e extrair o link de verificação
    const messageDetailRes = await fetch(`http://127.0.0.1:54324/api/v1/message/${mail.ID}`);
    expect(messageDetailRes.ok).toBe(true);
    const messageDetail = await messageDetailRes.json();
    const bodyText = messageDetail.Text || messageDetail.HTML;
    const match = bodyText.match(/(http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify[^\s\)\"\']+)/);
    expect(match).not.toBeNull();
    const verifyLink = match![1];

    // 4. Obter o token seguro do link de verificação do e-mail
    const parsedVerifyUrl = new URL(verifyLink);
    const tokenHash = parsedVerifyUrl.searchParams.get("token");
    expect(tokenHash).not.toBeNull();

    // 5. Estabelecer o contexto de recuperação verificando o token/OTP (padrão Supabase SSR)
    const recoveryClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    const { data: sessionData, error: verifyError } =
      await recoveryClient.auth.verifyOtp({
        token_hash: tokenHash!,
        type: "recovery",
      });
    expect(verifyError).toBeNull();
    expect(sessionData.session).not.toBeNull();
    expect(sessionData.user?.email).toBe(testUserEmail);

    // 6. Atualizar a senha com o cliente que possui o contexto de recuperação
    const updateResult = await AuthService.updateUserPassword(recoveryClient, newPassword);
    expect(updateResult.success).toBe(true);

    // 7. Rejeição da senha antiga após a alteração
    const oldLoginResult = await AuthService.signInWithPassword(publicClient, {
      email: testUserEmail,
      password: testUserPassword,
    });
    expect(oldLoginResult.success).toBe(false);

    // 8. Login bem-sucedido com a nova senha
    const newLoginResult = await AuthService.signInWithPassword(publicClient, {
      email: testUserEmail,
      password: newPassword,
    });
    expect(newLoginResult.success).toBe(true);
    if (newLoginResult.success) {
      expect(newLoginResult.user.email).toBe(testUserEmail);
    }

    // 9. Bloqueio de token reutilizado (deve falhar ao tentar reutilizar o mesmo token_hash)
    const freshClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false },
      }
    );
    const reusedVerify = await freshClient.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "recovery",
    });
    expect(reusedVerify.error).not.toBeNull();

    // 10. Bloqueio de token inválido/falso
    const invalidVerify = await freshClient.auth.verifyOtp({
      token_hash: "token_completamente_falso_e_invalido_12345",
      type: "recovery",
    });
    expect(invalidVerify.error).not.toBeNull();

    // 11. Restaurar a senha original para manter integridade da fixture
    await AuthService.updateUserPassword(recoveryClient, testUserPassword);
  });
});

