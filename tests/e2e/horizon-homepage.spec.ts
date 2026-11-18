import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { resolveSandboxPassword } from "../../sandbox-data/fixtures/users";

const ARTIFACT_DIR = "C:/Users/hugoa/.gemini/antigravity/brain/3c653b81-8bb6-4041-932c-bc5ef43ab6fd";
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");

test.describe("HORIZON & BrandLogo — Identidade Visual Oficial DevEssent", () => {
  test("1. Página inicial utiliza BrandLogo oficial, alterna temas (Claro/Escuro/Sistema), captura screenshots e navega para /login", async ({
    page,
  }) => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Valida presença dos elementos essenciais e do BrandLogo oficial
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("PLATAFORMA OPERACIONAL MULTIEMPRESA");
    expect(bodyText).toContain("Um espaço para conectar negócios, pessoas e operações.");
    expect(bodyText).toContain("Acessar plataforma");
    expect(bodyText).toContain("Acesso para equipes e administradores.");

    const h1 = page.locator("h1");
    await expect(h1).toContainText("DevEssent");
    await expect(h1).toContainText("Platform");

    // Valida botão de tema Sistema
    await page.getByRole("button", { name: "Tema Sistema" }).click();
    await page.waitForTimeout(200);

    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "desktop-1920", width: 1920, height: 1080 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-375", width: 375, height: 667 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(250);

      for (const theme of ["dark", "light"] as const) {
        const btnName = theme === "dark" ? "Tema Escuro" : "Tema Claro";
        await page.getByRole("button", { name: btnName }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.waitForTimeout(350);

        const visibleLogoLoaded = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img[alt="DevEssent"]')) as HTMLImageElement[];
          const visible = imgs.find((img) => img.offsetParent !== null);
          return Boolean(visible && visible.complete && visible.naturalWidth === 984 && visible.naturalHeight === 158);
        });
        expect(visibleLogoLoaded).toBe(true);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasOverflow).toBe(false);

        const filename = `horizon-${vp.name}-${theme}.png`;
        const docPath = path.join(SCREENSHOTS_DIR, filename);
        const artifactPath = path.join(ARTIFACT_DIR, filename);

        await page.screenshot({ path: docPath, fullPage: false });
        if (fs.existsSync(ARTIFACT_DIR)) {
          fs.copyFileSync(docPath, artifactPath);
        }
      }
    }

    // Valida navegação principal para /login
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Tema Escuro" }).click();
    await page.getByRole("link", { name: /Acessar plataforma/i }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 35000 });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("2. Cabeçalho do Workspace (/dashboard) exibe exatamente o mesmo BrandLogo oficial sem a palavra 'Workspace' em Desktop e Mobile (Claro e Escuro)", async ({
    page,
  }) => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login", { waitUntil: "networkidle" });

    // Faz login com credencial do cofre local de XAMPP ou Sandbox
    const xamppVaultPath = path.resolve(process.cwd(), "local-test/xampp/.credentials.local.json");
    let email = "owner.atelie@sandbox.devessent.test";
    let password = resolveSandboxPassword(email);
    if (fs.existsSync(xamppVaultPath)) {
      const parsed = JSON.parse(fs.readFileSync(xamppVaultPath, "utf-8")) as {
        defaultPassword?: string;
      };
      if (parsed.defaultPassword) {
        email = "owner.atelie@xampp.devessent.test";
        password = parsed.defaultPassword;
      }
    }
    await page.getByLabel("E-mail Corporativo").fill(email);
    await page.getByLabel("Senha de Acesso").fill(password);
    await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // Verifica que o link da marca na sidebar NÃO contém o texto "Workspace"
    const brandLink = page.locator('aside a[aria-label="DevEssent"]');
    await expect(brandLink).toBeVisible();
    const brandLinkText = (await brandLink.innerText()).trim();
    expect(brandLinkText).toBe("");

    // Desktop Dark & Light
    for (const theme of ["dark", "light"] as const) {
      const btnName = theme === "dark" ? "Tema Escuro" : "Tema Claro";
      await page.getByRole("button", { name: btnName }).first().click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.waitForTimeout(300);

      const sidebarLogoOk = await page.evaluate(() => {
        const imgs = Array.from(
          document.querySelectorAll('aside a[aria-label="DevEssent"] img[alt="DevEssent"]')
        ) as HTMLImageElement[];
        const visible = imgs.find((img) => img.offsetParent !== null);
        return Boolean(visible && visible.complete && visible.naturalWidth === 984 && visible.naturalHeight === 158);
      });
      expect(sidebarLogoOk).toBe(true);

      const filename = `workspace-logo-desktop-${theme}.png`;
      const docPath = path.join(SCREENSHOTS_DIR, filename);
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      await page.screenshot({ path: docPath, fullPage: false });
      if (fs.existsSync(ARTIFACT_DIR)) {
        fs.copyFileSync(docPath, artifactPath);
      }
    }

    // Mobile (390x844) com menu lateral aberto em Dark & Light
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    for (const theme of ["dark", "light"] as const) {
      const btnName = theme === "dark" ? "Tema Escuro" : "Tema Claro";
      await page.getByRole("button", { name: btnName }).first().click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.waitForTimeout(250);

      await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
      const mobileDialog = page.getByRole("dialog", { name: "Menu de navegação móvel" });
      await expect(mobileDialog).toBeVisible();

      // Verifica que o cabeçalho do menu mobile não contém "Workspace" acoplado à marca
      const mobileHeaderText = await mobileDialog.locator("div").first().innerText();
      expect(mobileHeaderText).not.toContain("Workspace");

      const filename = `workspace-logo-mobile-${theme}.png`;
      const docPath = path.join(SCREENSHOTS_DIR, filename);
      const artifactPath = path.join(ARTIFACT_DIR, filename);
      await page.screenshot({ path: docPath, fullPage: false });
      if (fs.existsSync(ARTIFACT_DIR)) {
        fs.copyFileSync(docPath, artifactPath);
      }

      await page.getByRole("button", { name: "Fechar menu de navegação" }).click();
      await page.waitForTimeout(200);
    }
  });
});
