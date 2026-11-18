import { test, expect } from "@playwright/test";
import { createAdminClient } from "../../src/lib/supabase/admin";

test.describe("E2E Suite — Multiempresa, Administração e Gestão de Membros (Fase 3B)", () => {
  const ts = Date.now();
  const adminEmail = `admin.e2e.${ts}@devessent.test`;
  const adminPassword = "SenhaAdminForte123!";
  const ownerEmail = `owner.e2e.${ts}@devessent.test`;
  const ownerPassword = "SenhaOwnerForte123!";
  const memberEmail = `member.e2e.${ts}@devessent.test`;
  const memberPassword = "SenhaMemberForte123!";

  const tenantName = `Empresa E2E ${ts}`;
  const tenantSlug = `empresa-e2e-${ts}`;

  let adminUserId: string;
  let ownerUserId: string;
  let memberUserId: string;
  let createdTenantId: string;

  test.beforeAll(async () => {
    const admin = createAdminClient();

    // 1. Provisionar Platform Admin
    const { data: uAdmin } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "Admin E2E DevEssent" },
    });
    adminUserId = uAdmin.user!.id;
    await admin.from("platform_admins").insert({ user_id: adminUserId });

    // 2. Provisionar Owner
    const { data: uOwner } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: "Proprietário E2E" },
    });
    ownerUserId = uOwner.user!.id;

    // 3. Provisionar Membro Convidado
    const { data: uMember } = await admin.auth.admin.createUser({
      email: memberEmail,
      password: memberPassword,
      email_confirm: true,
      user_metadata: { full_name: "Membro Convidado E2E" },
    });
    memberUserId = uMember.user!.id;
  });

  test.beforeEach(async ({ context }) => {
    // Garantir isolamento de cookies e sessão entre cada cenário E2E
    await context.clearCookies();
  });

  test.afterAll(async () => {
    const admin = createAdminClient();
    if (createdTenantId) {
      await admin.from("tenants").delete().eq("id", createdTenantId);
    }
    const userIds = [adminUserId, ownerUserId, memberUserId];
    for (const uid of userIds) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  test("1. Platform Admin acessa /admin, cadastra nova empresa e visualiza status ativo", async ({
    page,
  }) => {
    // 1. Login como Platform Admin
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(adminEmail);
    await page.getByLabel("Senha de Acesso").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 2. Acessar painel administrativo /admin
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");
    await expect(page.getByText("Painel Central de Gestão SaaS")).toBeVisible();

    // 3. Navegar para cadastro de nova empresa
    await page.goto("/admin/empresas/nova");
    await expect(page).toHaveURL("/admin/empresas/nova");

    // 4. Preencher formulário de cadastro atômico
    await page.getByLabel("Nome do Estabelecimento").fill(tenantName);
    await page.getByLabel("Slug Público (Identificador Único)").fill(tenantSlug);
    await page.getByLabel("Nome Completo").fill("Proprietário E2E");
    await page.getByLabel("E-mail Corporativo").fill(ownerEmail);
    await page.getByRole("button", { name: "Criar Estabelecimento com Atomicidade" }).click();

    // 5. Redirecionamento para /admin/empresas com a nova empresa listada como Ativa
    await expect(page).toHaveURL("/admin/empresas", { timeout: 20000 });
    await expect(page.getByText(tenantName).first()).toBeVisible();
    await expect(page.getByText(tenantSlug).first()).toBeVisible();

    // Capturar ID do tenant criado para cleanup
    const admin = createAdminClient();
    const { data: t } = await admin.from("tenants").select("id").eq("slug", tenantSlug).single();
    if (t) createdTenantId = t.id;
  });

  test("2. Proprietário acessa /dashboard, visualiza seu estabelecimento ativo e altera configurações", async ({
    page,
  }) => {
    // 1. Login como Proprietário
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(ownerEmail);
    await page.getByLabel("Senha de Acesso").fill(ownerPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 2. Dashboard exibe o estabelecimento ativo e papel de Proprietário
    await expect(page.getByText(tenantName).first()).toBeVisible();
    await expect(page.getByText(/Papel:\s*Proprietário/i)).toBeVisible();

    // 3. Navegar para Configurações
    await page.goto("/dashboard/configuracoes");
    await expect(page).toHaveURL("/dashboard/configuracoes");

    // 4. Atualizar nome fantasia
    const updatedName = `${tenantName} - Atualizado`;
    await page.getByLabel("Nome de Exibição (Fantasia)").fill(updatedName);
    await page.getByRole("button", { name: "Salvar Configurações" }).click();

    // 5. Feedback de sucesso
    await expect(page.getByText("Configurações atualizadas com sucesso.")).toBeVisible();
  });

  test("3. Proprietário emite convite em /dashboard/membros e destinatário aceita o convite completamente pelo navegador", async ({
    page,
    context,
  }) => {
    // 1. Login como Proprietário
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(ownerEmail);
    await page.getByLabel("Senha de Acesso").fill(ownerPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 2. Navegar para Gestão de Membros
    await page.goto("/dashboard/membros");
    await expect(page).toHaveURL("/dashboard/membros");

    // 3. Emitir convite para o membro
    await page.getByLabel("E-mail Corporativo do Convidado").fill(memberEmail);
    await page.getByRole("button", { name: "Emitir Convite" }).click();

    // 4. Feedback de convite emitido com sucesso e link gerado
    await expect(page.getByText(new RegExp(`Convite enviado com sucesso para ${memberEmail}`, "i"))).toBeVisible({
      timeout: 15000,
    });
    const inviteLinkLocator = page.locator("div[role='alert'] span.font-mono");
    await expect(inviteLinkLocator).toBeVisible({ timeout: 10000 });
    const inviteUrl = await inviteLinkLocator.textContent();
    expect(inviteUrl).toContain("/convite/");

    // 5. Limpar cookies para simular o convidado acessando a plataforma
    await context.clearCookies();

    // 6. Login como o Membro Convidado
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(memberEmail);
    await page.getByLabel("Senha de Acesso").fill(memberPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // Inicialmente o membro não tem estabelecimentos vinculados
    await expect(page.getByText("Nenhum Estabelecimento Vinculado")).toBeVisible();

    // 7. O membro convidado acessa o link do convite
    await page.goto(inviteUrl!.trim());
    await expect(page.getByText("Convite de Estabelecimento")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(tenantName).first()).toBeVisible();

    // 8. O membro aceita o convite clicando no botão
    await page.getByRole("button", { name: "Aceitar Convite e Acessar" }).click();

    // 9. Redirecionamento para o dashboard com o estabelecimento ativo visível
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });
    await expect(page.getByText(tenantName).first()).toBeVisible();
    await expect(page.getByText(/Papel:\s*Equipe/i)).toBeVisible();
  });

  test("4. Proprietário revoga a membership de um colaborador e ex-membro tem acesso bloqueado", async ({
    page,
    context,
  }) => {
    // 1. Login como Proprietário
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(ownerEmail);
    await page.getByLabel("Senha de Acesso").fill(ownerPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 2. Acessar /dashboard/membros
    await page.goto("/dashboard/membros");
    await expect(page).toHaveURL("/dashboard/membros");

    // 3. Localizar a linha do membro convidado e remover acesso via ConfirmationDialog (<dialog>)
    const memberRow = page.locator("tr", { hasText: "Membro Convidado E2E" });
    await expect(memberRow).toBeVisible({ timeout: 10000 });
    await memberRow.getByRole("button", { name: /Remover/i }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Confirmar Remoção" }).click();

    // 4. Feedback de remoção bem-sucedida
    await expect(page.getByText(/Membro removido com sucesso/i)).toBeVisible({ timeout: 15000 });

    // 5. Limpar cookies para simular o ex-membro tentando navegar
    await context.clearCookies();

    // 6. Login como o Ex-Membro
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(memberEmail);
    await page.getByLabel("Senha de Acesso").fill(memberPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 7. Dashboard do ex-membro não possui mais estabelecimentos vinculados
    await expect(page.getByText("Nenhum Estabelecimento Vinculado")).toBeVisible();
  });

  test("5. Suspensão administrativa de empresa reflete imediatamente no bloqueio do estabelecimento", async ({
    page,
    context,
  }) => {
    // 1. Login como Platform Admin para suspender a empresa
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(adminEmail);
    await page.getByLabel("Senha de Acesso").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 2. Ir para lista de empresas e suspender o tenant recém-criado
    await page.goto("/admin/empresas");
    await expect(page).toHaveURL("/admin/empresas");

    const tenantRow = page.locator("tr", { hasText: tenantName });
    await expect(tenantRow).toBeVisible({ timeout: 10000 });
    await tenantRow.getByRole("button", { name: "Suspender" }).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Confirmar Suspensão" }).click();

    // 3. Verificar que o badge na linha da empresa muda para Suspenso
    await expect(tenantRow.getByText("Suspenso")).toBeVisible({ timeout: 15000 });

    // 4. Limpar cookies simulando troca para o proprietário
    await context.clearCookies();

    // 5. Login como o Proprietário
    await page.goto("/login");
    await page.getByLabel("E-mail Corporativo").fill(ownerEmail);
    await page.getByLabel("Senha de Acesso").fill(ownerPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 20000 });

    // 6. Dashboard deve exibir alerta explícito de empresa suspensa
    await expect(page.getByText("Estabelecimento Suspenso")).toBeVisible();
  });
});

