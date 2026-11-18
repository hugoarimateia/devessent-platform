import { test, expect } from "@playwright/test";
import { createAdminClient } from "../../src/lib/supabase/admin";

const TEST_EMAIL = "usuario.teste@devessent.test";
const TEST_PASSWORD = "SenhaForteLocal123!";

test.describe("E2E Suite — Fluxo Completo de Autenticação e Proteção de Rotas", () => {
  test.beforeAll(async () => {
    const admin = createAdminClient();
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === TEST_EMAIL);
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, {
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Usuário Teste Local" },
      });
      await admin.from("profiles").upsert({ id: existing.id, full_name: "Usuário Teste Local" });
    } else {
      const { data: created } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Usuário Teste Local" },
      });
      if (created?.user) {
        await admin.from("profiles").upsert({ id: created.user.id, full_name: "Usuário Teste Local" });
      }
    }
  });
  test("1. Acesso a /dashboard sem autenticação redireciona para /login com parâmetro redirect", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.getByLabel("E-mail Corporativo")).toBeVisible();
  });

  test("2. Acesso a /admin sem autenticação redireciona para /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin/);
  });

  test("3. Tentativa de login com senha incorreta exibe alerta amigável e preserva o e-mail", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill(TEST_EMAIL);
    await page.getByLabel("Senha de Acesso").fill("SenhaTotalmenteIncorreta!");
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    // Mensagem de erro deve ser exibida no alerta de erro da aplicação
    const errorAlert = page
      .getByRole("alert")
      .filter({ hasText: "E-mail ou senha incorretos" });
    await expect(errorAlert).toBeVisible();

    // E-mail deve ser preservado no campo
    await expect(page.getByLabel("E-mail Corporativo")).toHaveValue(TEST_EMAIL);
  });

  test("4. Login com credenciais válidas direciona para o dashboard com persistência e logout", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail Corporativo").fill(TEST_EMAIL);
    await page.getByLabel("Senha de Acesso").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    // Redirecionamento para /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.getByText(/Olá,\s*Usuário Teste Local/i)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL).first()).toBeVisible();
    await expect(page.getByText("Sessão Ativa e Segura")).toHaveCount(0);

    // Atualização de página (reload) para validar persistência de sessão
    await page.reload();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText(/Olá,\s*Usuário Teste Local/i)).toBeVisible();

    // Executar Logout via Menu da Conta
    await page.getByRole("button", { name: "Menu da conta" }).click();
    await page.getByRole("menuitem", { name: /encerrar sessão/i }).click();

    // Redirecionamento para o /login
    await expect(page).toHaveURL("/login");

    // Tentar acessar /dashboard após o logout deve ser bloqueado
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test("5. Fluxo de solicitação de recuperação de senha em /recuperar-senha", async ({
    page,
  }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperação de Acesso" })).toBeVisible();

    await page.getByLabel("E-mail Cadastrado").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Enviar Instruções" }).click();

    // Confirmação genérica exibida para o usuário
    await expect(page.getByRole("heading", { name: "Instruções enviadas" })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("6. Responsividade em viewport móvel (375x667)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.getByLabel("E-mail Corporativo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar na Plataforma" })).toBeVisible();
  });

  test("7. Tentativa de acesso a /admin por usuário comum autenticado é bloqueada no servidor (403 Forbidden)", async ({
    page,
  }) => {
    // 1. Efetuar login como usuário comum (sem vínculo na tabela platform_admins)
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(TEST_EMAIL);
    await page.getByLabel("Senha de Acesso").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Tentar acessar diretamente o painel da plataforma /admin
    await page.goto("/admin");

    // 3. O servidor (AdminLayout / Server Component) deve barrar e redirecionar para /forbidden
    await expect(page).toHaveURL("/forbidden");
    await expect(page.getByRole("heading", { name: "Acesso Restrito" })).toBeVisible();
    await expect(page.getByText("403")).toBeVisible();
  });

  test("8. Sessão corrompida ou revogada redireciona imediatamente para /login", async ({
    page,
    context,
  }) => {
    // 1. Login válido
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(TEST_EMAIL);
    await page.getByLabel("Senha de Acesso").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Limpar cookies de sessão simulando expiração / revogação
    await context.clearCookies();

    // 3. Tentar acessar rota privada
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });
});
