import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { test, expect, type Page } from "@playwright/test";
import { createAdminClient } from "../../src/lib/supabase/admin";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const CAPTURE_DIR = path.resolve(process.cwd(), "docs/visual-review/fase-5b");

async function saveCapture(page: Page, filename: string) {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(CAPTURE_DIR, filename),
    fullPage: true,
  });
}

async function setThemeAndVerify(page: Page, mode: "light" | "dark") {
  const label = mode === "light" ? "Tema Claro" : "Tema Escuro";
  await page
    .locator("header")
    .getByRole("button", { name: label })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" })
  ).toBeVisible({ timeout: 15000 });
  await page.getByLabel("E-mail Corporativo").fill(email);
  await page.getByLabel("Senha de Acesso").fill(password);
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25000 });
}

test.describe("Fase 5B E2E — Auditoria, RBAC, Reenvio de Convite, Ciclo Multiempresa e Responsividade", () => {
  const ts = Date.now();
  const ephemeralAdminEmail = `admin.5b.${ts}@teste.devessent.test`;
  const ephemeralOwnerEmail = `owner.5b.${ts}@teste.devessent.test`;
  const ephemeralInviteeEmail = `invitee.5b.${ts}@teste.devessent.test`;
  const ephemeralPassword = "E2eFase5b@2026!Strong";
  const ephemeralTenantName = `Empresa Ciclo 5B ${ts}`;
  const ephemeralTenantSlug = `ciclo-5b-${ts}`;

  let ephemeralAdminId = "";
  let ephemeralOwnerId = "";
  let ephemeralInviteeId = "";
  let ephemeralTenantId = "";
  let capturedInviteUrl = "";
  let blockedPendingInviteUrl = "";

  test.beforeAll(async () => {
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    const admin = createAdminClient();

    const { data: uAdmin, error: adminErr } = await admin.auth.admin.createUser({
      email: ephemeralAdminEmail,
      password: ephemeralPassword,
      email_confirm: true,
      user_metadata: { full_name: "Admin Ciclo 5B" },
    });
    if (adminErr || !uAdmin.user) {
      throw new Error(`Falha provisionando admin E2E: ${adminErr?.message}`);
    }
    ephemeralAdminId = uAdmin.user.id;
    await admin.from("platform_admins").insert({ user_id: ephemeralAdminId });

    const { data: uOwner, error: ownerErr } = await admin.auth.admin.createUser({
      email: ephemeralOwnerEmail,
      password: ephemeralPassword,
      email_confirm: true,
      user_metadata: { full_name: "Owner Ciclo 5B" },
    });
    if (ownerErr || !uOwner.user) {
      throw new Error(`Falha provisionando owner E2E: ${ownerErr?.message}`);
    }
    ephemeralOwnerId = uOwner.user.id;

    const { data: uInvitee, error: invErr } = await admin.auth.admin.createUser({
      email: ephemeralInviteeEmail,
      password: ephemeralPassword,
      email_confirm: true,
      user_metadata: { full_name: "Convidada Ciclo 5B" },
    });
    if (invErr || !uInvitee.user) {
      throw new Error(`Falha provisionando invitee E2E: ${invErr?.message}`);
    }
    ephemeralInviteeId = uInvitee.user.id;
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.afterAll(async () => {
    const admin = createAdminClient();
    const userIds = [ephemeralAdminId, ephemeralOwnerId, ephemeralInviteeId].filter(Boolean);

    if (userIds.length > 0) {
      await admin.from("audit_logs").delete().in("actor_user_id", userIds);
    }
    if (ephemeralTenantId) {
      await admin.from("tenants").delete().eq("id", ephemeralTenantId);
    }
    if (ephemeralAdminId) {
      await admin.from("platform_admins").delete().eq("user_id", ephemeralAdminId);
    }

    const emailHashes = [ephemeralAdminEmail, ephemeralOwnerEmail, ephemeralInviteeEmail].map((e) =>
      createHash("sha256").update(e.trim().toLowerCase()).digest("hex")
    );
    await admin.from("rate_limits").delete().in("identifier", emailHashes);

    for (const uid of userIds) {
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  test("1. Auditoria Global Admin (/admin/atividades), Modal de Detalhes e Link Auditoria em /admin/empresas", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sandboxPassword = resolveSandboxPassword("admin.global@sandbox.devessent.test");
    await loginWithCredentials(page, "admin.global@sandbox.devessent.test", sandboxPassword);

    // Link "Atividades" deve existir na navegação lateral do console administrativo
    await page.goto("/admin/empresas");
    await expect(
      page.getByRole("heading", { name: "Gestão de Estabelecimentos SaaS" })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("aside a[href='/admin/atividades']")).toBeVisible();

    // Clicar no botão "Auditoria" de uma empresa abre a trilha filtrada por tenantId
    await page.getByRole("link", { name: "Auditoria" }).first().click();
    await expect(page).toHaveURL(/\/admin\/atividades\?tenantId=/, { timeout: 20000 });
    await expect(
      page.getByRole("heading", { name: "Histórico Global de Atividades" })
    ).toBeVisible();

    // Limpar filtro para inspecionar histórico completo
    await page.goto("/admin/atividades");
    await expect(
      page.getByRole("heading", { name: "Histórico Global de Atividades" })
    ).toBeVisible({ timeout: 20000 });

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-atividades-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "admin-atividades-dark.png");

    // Abrir detalhes do primeiro evento no <dialog> nativo
    await page.getByRole("button", { name: /Detalhes/i }).first().click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Metadados Sanitizados")).toBeVisible();

    const metadataText = await dialog.locator("pre").innerText();
    expect(metadataText).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
    expect(metadataText).not.toContain("service_role");

    await saveCapture(page, "audit-detail-dialog-dark.png");
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("2. Escopo RBAC na Navegação e Auditoria: Owner (full) vs Manager (operacional) vs Staff (bloqueado + link oculto)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // A) Proprietária no Ateliê Sandbox
    const ownerPass = resolveSandboxPassword("owner.atelie@sandbox.devessent.test");
    await loginWithCredentials(page, "owner.atelie@sandbox.devessent.test", ownerPass);

    await expect(
      page.locator("aside[aria-label='Navegação principal'] a[href='/dashboard/atividades']")
    ).toBeVisible();
    await page
      .locator("aside[aria-label='Navegação principal'] a[href='/dashboard/atividades']")
      .click();
    await expect(page).toHaveURL("/dashboard/atividades", { timeout: 20000 });
    await expect(
      page.getByRole("heading", { name: "Histórico de Atividades" })
    ).toBeVisible();

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-atividades-owner-light.png");

    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-atividades-owner-dark.png");

    // Capturar drawer mobile em /dashboard/atividades (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await expect(page.locator("dialog[open] a[href='/dashboard/atividades']")).toBeVisible();
    await saveCapture(page, "mobile-nav-atividades-light.png");
    await page.keyboard.press("Escape");

    // Limpar sessão para testar Camila Duarte (Gestor na Verde Sandbox, Equipe no Ateliê Sandbox)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().clearCookies();

    const multiPass = resolveSandboxPassword("multi.member@sandbox.devessent.test");
    await loginWithCredentials(page, "multi.member@sandbox.devessent.test", multiPass);

    // Selecionar Verde Sandbox (Gestor) se necessário
    const isVerdeActive = await page
      .getByRole("heading", { name: "Verde Sandbox" })
      .isVisible()
      .catch(() => false);
    if (!isVerdeActive) {
      await page.locator("header button").filter({ hasText: /Sandbox/i }).first().click();
      await page.locator("header button").filter({ hasText: "Verde Sandbox" }).click();
      await expect(page.getByRole("heading", { name: "Verde Sandbox" })).toBeVisible({
        timeout: 20000,
      });
    }

    // Gestor vê Atividades e acessa sem eventos de governança (tenant.created/suspended/activated)
    await expect(
      page.locator("aside[aria-label='Navegação principal'] a[href='/dashboard/atividades']")
    ).toBeVisible();
    await page.goto("/dashboard/atividades");
    await expect(
      page.getByRole("heading", { name: "Histórico de Atividades" })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator("select[aria-label='Filtrar por tipo de ação'] option[value='tenant.suspended']")).toHaveCount(0);

    // Alternar para Ateliê Sandbox (Equipe / staff)
    await page.locator("header button").filter({ hasText: "Verde Sandbox" }).first().click();
    await page.locator("header button").filter({ hasText: "Ateliê Sandbox" }).click();
    await expect(page.getByRole("heading", { name: "Ateliê Sandbox" })).toBeVisible({
      timeout: 20000,
    });

    // Staff NÃO enxerga o link Atividades na sidebar
    await expect(
      page.locator("aside[aria-label='Navegação principal'] a[href='/dashboard/atividades']")
    ).toHaveCount(0);

    // Acesso direto à URL por Staff exibe AccessDeniedState amigável
    await page.goto("/dashboard/atividades");
    await expect(
      page.getByRole("heading", { name: "Auditoria Restrita à Gestão" })
    ).toBeVisible({ timeout: 20000 });
    await saveCapture(page, "dashboard-atividades-staff-denied-light.png");
  });

  test("3. Ciclo de Vida Completo (12 Etapas): Criação -> Config -> Convite -> Aceite -> Promoção -> Auditoria -> Suspensão -> Reativação", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Etapas 1-2: Platform Admin cria empresa atômica com owner
    await loginWithCredentials(page, ephemeralAdminEmail, ephemeralPassword);
    await page.goto("/admin/empresas/nova");

    await page.getByLabel("Nome do Estabelecimento").fill(ephemeralTenantName);
    await page.getByLabel("Slug Público (Identificador Único)").fill(ephemeralTenantSlug);
    await page.getByLabel("Nome Completo").fill("Owner Ciclo 5B");
    await page.getByLabel("E-mail Corporativo").fill(ephemeralOwnerEmail);
    await page.getByRole("button", { name: "Criar Estabelecimento com Atomicidade" }).click();

    await expect(page).toHaveURL("/admin/empresas", { timeout: 25000 });
    await expect(page.getByText(ephemeralTenantName).first()).toBeVisible();

    const admin = createAdminClient();
    const { data: createdTenant } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", ephemeralTenantSlug)
      .single();
    expect(createdTenant).toBeTruthy();
    ephemeralTenantId = createdTenant!.id;

    // Verificar evento tenant.created na trilha global filtrada
    await page.goto(`/admin/atividades?tenantId=${ephemeralTenantId}`);
    await expect(
      page.locator("tbody").getByText("Estabelecimento cadastrado").first()
    ).toBeVisible({
      timeout: 20000,
    });

    // Etapas 3-4: Owner acessa configurações, valida erro inline em telefone inválido e salva telefone formatado
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralOwnerEmail, ephemeralPassword);
    await expect(page.getByRole("heading", { name: ephemeralTenantName })).toBeVisible();

    await page.goto("/dashboard/configuracoes");
    await expect(
      page.getByRole("heading", { name: "Configurações do Estabelecimento" })
    ).toBeVisible({ timeout: 20000 });

    await page.getByLabel("Telefone / WhatsApp").fill("abc-telefone-invalido");
    await page.getByRole("button", { name: "Salvar Configurações" }).click();
    await expect(page.locator("#error-contact_phone")).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Telefone / WhatsApp")).toHaveAttribute("aria-invalid", "true");
    await setThemeAndVerify(page, "light");
    await saveCapture(page, "dashboard-configuracoes-validacao-light.png");

    await page.getByLabel("Telefone / WhatsApp").fill("(11) 98888-1001");
    await page.locator("#monogram").fill("ec");
    await page.getByRole("button", { name: "Salvar Configurações" }).click();
    await expect(
      page.getByText("Configurações atualizadas com sucesso.")
    ).toBeVisible({ timeout: 20000 });
    await setThemeAndVerify(page, "dark");
    await saveCapture(page, "dashboard-configuracoes-dark.png");

    // Etapa 5: Owner emite convite em /dashboard/membros e valida cópia do link
    await page.goto("/dashboard/membros");
    await expect(
      page.getByRole("heading", { name: "Membros do Estabelecimento", exact: true })
    ).toBeVisible({ timeout: 20000 });

    await page.getByLabel("E-mail Corporativo do Convidado").fill(ephemeralInviteeEmail);
    await page.getByLabel("Papel Atribuído").selectOption("staff");
    await page.getByRole("button", { name: "Emitir Convite" }).click();

    await expect(page.locator("#generated-invite-url")).toBeVisible({ timeout: 20000 });
    capturedInviteUrl = (await page.locator("#generated-invite-url").innerText()).trim();
    expect(capturedInviteUrl).toContain("/convite/");

    // Emitir um segundo convite, revogar, filtrar na aba "Expirados / Revogados" e reenviar via UI
    const extraEmail = `suspenso.convite.${ts}@teste.devessent.test`;
    await page.getByLabel("E-mail Corporativo do Convidado").fill(extraEmail);
    await page.getByLabel("Papel Atribuído").selectOption("staff");
    await page.getByRole("button", { name: "Emitir Convite" }).click();
    await expect(page.locator("#generated-invite-url")).not.toHaveText(capturedInviteUrl, {
      timeout: 20000,
    });

    const revokeRow = page.locator("tr", { hasText: extraEmail });
    await revokeRow.getByRole("button", { name: "Revogar" }).click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Confirmar Revogação" })
      .click();
    await expect(page.getByText("Convite revogado com sucesso.")).toBeVisible({ timeout: 15000 });

    // Filtrar aba de Expirados / Revogados e acionar "Reenviar"
    await page.getByRole("tab", { name: /Expirados \/ Revogados/i }).click();
    const closedRow = page.locator("tr", { hasText: extraEmail }).first();
    await expect(closedRow).toBeVisible();
    await closedRow.getByRole("button", { name: "Reenviar" }).click();
    await expect(page.locator("#generated-invite-url")).toBeVisible({ timeout: 20000 });
    blockedPendingInviteUrl = (
      await page.locator("#generated-invite-url").innerText()
    ).trim();

    await page
      .getByRole("tablist", { name: "Filtrar convites por situação" })
      .getByRole("tab", { name: /^Todos/i })
      .click();

    await setThemeAndVerify(page, "light");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-membros-convites-light.png");
    await setThemeAndVerify(page, "dark");
    await assertNoHorizontalOverflow(page);
    await saveCapture(page, "dashboard-membros-convites-dark.png");

    // Etapa 6: Convidada aceita convite pela tela pública /convite/[token]
    await page.context().clearCookies();
    const invitePath = new URL(capturedInviteUrl, "http://localhost:3000").pathname;
    await page.goto(invitePath);
    await expect(page.getByText(ephemeralTenantName).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: new RegExp(`Entrar com ${ephemeralInviteeEmail}`) }).click();

    await page.getByLabel("E-mail Corporativo").fill(ephemeralInviteeEmail);
    await page.getByLabel("Senha de Acesso").fill(ephemeralPassword);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL(new RegExp(invitePath), { timeout: 25000 });
    await page.getByRole("button", { name: "Aceitar Convite e Acessar" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 25000 });
    await expect(page.getByRole("heading", { name: ephemeralTenantName })).toBeVisible();

    // Etapa 7: Owner promove Convidada de Equipe -> Gestor via ConfirmationDialog
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralOwnerEmail, ephemeralPassword);
    await page.goto("/dashboard/membros");

    const memberRow = page.locator("tr", { hasText: "Convidada Ciclo 5B" });
    await expect(memberRow).toBeVisible({ timeout: 20000 });
    await memberRow.getByRole("button", { name: "Tornar Gestor" }).click();

    const roleDialog = page.locator("dialog[open]");
    await expect(roleDialog.getByText("Confirmar Alteração de Papel")).toBeVisible();
    await roleDialog.getByRole("button", { name: "Confirmar Alteração" }).click();
    await expect(roleDialog).toBeHidden({ timeout: 15000 });
    await expect(memberRow.getByText("Gestor", { exact: true })).toBeVisible({ timeout: 15000 });

    // Etapa 8: Gestora promovida vê auditoria operacional (member.role_updated) sem tenant.created
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralInviteeEmail, ephemeralPassword);
    await expect(
      page.locator("aside[aria-label='Navegação principal'] a[href='/dashboard/atividades']")
    ).toBeVisible();
    await page.goto("/dashboard/atividades");
    await expect(
      page.locator("tbody").getByText("Papel de integrante atualizado").first()
    ).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.locator("tbody").getByText("Estabelecimento cadastrado")
    ).toHaveCount(0);

    // Etapa 9: Admin suspende estabelecimento em /admin/empresas
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralAdminEmail, ephemeralPassword);
    await page.goto("/admin/empresas");

    const tenantRow = page.locator("tr", { hasText: ephemeralTenantSlug });
    await expect(tenantRow).toBeVisible({ timeout: 20000 });
    await tenantRow.getByRole("button", { name: "Suspender" }).click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Confirmar Suspensão" })
      .click();
    await expect(tenantRow.getByText("Suspenso", { exact: true })).toBeVisible({ timeout: 15000 });

    // Etapa 10: Verificar bloqueio em sub-rotas (/dashboard/membros, /configuracoes, /atividades) e convite sob suspensão
    await page.context().clearCookies();
    const blockedInvitePath = new URL(blockedPendingInviteUrl, "http://localhost:3000").pathname;
    await page.goto(blockedInvitePath);
    await expect(page.getByText("Estabelecimento Suspenso").first()).toBeVisible({
      timeout: 15000,
    });

    await loginWithCredentials(page, ephemeralOwnerEmail, ephemeralPassword);
    for (const route of ["/dashboard", "/dashboard/membros", "/dashboard/configuracoes", "/dashboard/atividades"]) {
      await page.goto(route);
      await expect(page.getByText("Estabelecimento Suspenso").first()).toBeVisible({
        timeout: 20000,
      });
    }
    await setThemeAndVerify(page, "light");
    await saveCapture(page, "tenant-suspenso-subrota-light.png");

    // Etapa 11: Admin reativa estabelecimento e confirma evento de auditoria
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralAdminEmail, ephemeralPassword);
    await page.goto("/admin/empresas");

    const suspendedRow = page.locator("tr", { hasText: ephemeralTenantSlug });
    await suspendedRow.getByRole("button", { name: "Reativar" }).click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Confirmar Reativação" })
      .click();
    await expect(suspendedRow.getByText("Ativo", { exact: true })).toBeVisible({ timeout: 15000 });

    await page.goto(`/admin/atividades?tenantId=${ephemeralTenantId}`);
    await expect(
      page.locator("tbody").getByText("Estabelecimento reativado").first()
    ).toBeVisible({
      timeout: 20000,
    });

    // Etapa 12: Owner volta a operar normalmente após reativação
    await page.context().clearCookies();
    await loginWithCredentials(page, ephemeralOwnerEmail, ephemeralPassword);
    await expect(page.getByRole("heading", { name: ephemeralTenantName })).toBeVisible({
      timeout: 20000,
    });
    await page.goto("/dashboard/atividades");
    await expect(
      page.locator("tbody").getByText("Estabelecimento reativado").first()
    ).toBeVisible({
      timeout: 20000,
    });
  });
});
