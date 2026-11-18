import * as fs from "fs";
import * as path from "path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveSandboxPassword } from "../sandbox-data/fixtures/users";
import { createAdminClient } from "../src/lib/supabase/admin";
import { TenantService } from "../src/core/tenants/services/tenant-service";
import { AuditService } from "../src/core/audit/services/audit-service";

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

interface SummaryStats {
  samplesMs: number[];
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
}

interface ProlongedStats extends SummaryStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  failureRatePct: number;
}

interface ResourceMetrics {
  totalRequests: number;
  jsRequests: number;
  jsTransferBytes: number;
  totalTransferBytes: number;
  rscPrefetchRequests: number;
  docTransferBytes: number;
}

interface RouteAuditResult {
  route: string;
  role: string;
  firstVisit: {
    status: number;
    finalUrl: string;
    usableHeadingMs: number;
    networkIdleMs: number;
    ttfbMs: number;
    domInteractiveMs: number;
    loadEventMs: number;
    resources: ResourceMetrics;
  };
  warmReloads: {
    count: number;
    usableHeadingStats: SummaryStats;
    ttfbStats: SummaryStats;
  };
}

interface ClientNavStep {
  from: string;
  to: string;
  label: string;
  durationMs: number;
  finalUrl: string;
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function summarize(values: number[]): SummaryStats {
  if (values.length === 0) {
    return {
      samplesMs: [],
      minMs: 0,
      maxMs: 0,
      meanMs: 0,
      medianMs: 0,
      p95Ms: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  const p95Idx = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1
  );

  return {
    samplesMs: values.map((v) => round(v)),
    minMs: round(sorted[0]),
    maxMs: round(sorted[sorted.length - 1]),
    meanMs: round(sum / sorted.length),
    medianMs: round(median),
    p95Ms: round(sorted[p95Idx]),
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArg(prefix: string, fallback: string): string {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function benchmarkSupabaseQueries() {
  console.log("\n--- [1] Consultas Individuais ao Supabase / PostgreSQL (5x cada) ---");
  const admin = createAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const ownerEmail = "owner.atelie@sandbox.devessent.test";
  const ownerPassword = resolveSandboxPassword(ownerEmail);

  const authClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tSign0 = performance.now();
  const { data: signInData, error: signInErr } =
    await authClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
  const signInMs = performance.now() - tSign0;

  if (signInErr || !signInData.session || !signInData.user) {
    throw new Error(`Falha no login Sandbox para benchmark DB: ${signInErr?.message}`);
  }

  const userId = signInData.user.id;
  const accessToken = signInData.session.access_token;

  // Cliente autenticado como owner.atelie respeitando RLS
  const userRlsClient = createSupabaseClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenantsData } = await userRlsClient
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1);
  const tenantId = tenantsData?.[0]?.tenant_id;
  if (!tenantId) {
    throw new Error("Tenant Ateliê não localizado para benchmark de queries.");
  }

  const adminUser = (await admin.auth.admin.listUsers({ perPage: 100 })).data?.users.find(
    (u) => u.email === "admin.global@sandbox.devessent.test"
  );

  async function measure5x(label: string, fn: () => Promise<unknown>): Promise<SummaryStats> {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await fn();
      samples.push(performance.now() - t0);
    }
    const stats = summarize(samples);
    console.log(
      `  • ${label}: mediana=${stats.medianMs}ms | média=${stats.meanMs}ms | min=${stats.minMs}ms | max=${stats.maxMs}ms`
    );
    return stats;
  }

  const queries: Record<string, SummaryStats | { singleMs: number }> = {
    signInWithPassword: { singleMs: round(signInMs) },
    "auth.getUser": await measure5x("auth.getUser (GoTrue)", () =>
      authClient.auth.getUser(accessToken)
    ),
    "profiles.select": await measure5x("SELECT profiles (RLS)", () =>
      Promise.resolve(
        userRlsClient
          .from("profiles")
          .select("full_name, avatar_path, created_at")
          .eq("id", userId)
          .maybeSingle()
      )
    ),
    "platform_admins.select": await measure5x("SELECT platform_admins (RLS)", () =>
      Promise.resolve(
        userRlsClient
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle()
      )
    ),
    "tenant_memberships.listUserTenants": await measure5x(
      "SELECT listUserTenants (Join settings, RLS)",
      () => TenantService.listUserTenants(userRlsClient, userId)
    ),
    "resolveTenantContext": await measure5x("resolveTenantContext (RLS)", () =>
      TenantService.resolveTenantContext(userRlsClient, userId, tenantId)
    ),
    "tenant_settings.select": await measure5x("SELECT tenant_settings (RLS)", () =>
      Promise.resolve(
        userRlsClient
          .from("tenant_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .single()
      )
    ),
    "tenant_invitations.select": await measure5x("SELECT tenant_invitations (RLS)", () =>
      Promise.resolve(
        userRlsClient
          .from("tenant_invitations")
          .select("id, email, role, status, expires_at, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
      )
    ),
    "audit_logs.tenant_page": await measure5x("SELECT audit_logs tenant page (RLS)", () =>
      AuditService.listTenantAuditLogs(userRlsClient, userId, tenantId, {
        period: "30d",
        page: 1,
        pageSize: 15,
      })
    ),
    "tenants.listAll_admin": await measure5x("listAllTenants (Platform Admin)", () =>
      adminUser
        ? TenantService.listAllTenants(admin, adminUser.id)
        : Promise.resolve([])
    ),
  };

  return queries;
}

async function benchmarkHttpLogin(baseUrl: string) {
  console.log(`\n--- [2] HTTP /login (Cold/1ª, 5x Quentes e Estabilidade 20x) em ${baseUrl} ---`);

  async function singleFetch(url: string) {
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store", redirect: "manual" });
    const ttfbMs = performance.now() - t0;
    await res.text();
    const totalMs = performance.now() - t0;
    return { status: res.status, ttfbMs: round(ttfbMs), totalMs: round(totalMs) };
  }

  const first = await singleFetch(`${baseUrl}/login`);
  console.log(`  • 1ª requisição /login: HTTP ${first.status} | TTFB=${first.ttfbMs}ms | Total=${first.totalMs}ms`);

  const warmTtfb: number[] = [];
  const warmTotal: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await singleFetch(`${baseUrl}/login`);
    warmTtfb.push(r.ttfbMs);
    warmTotal.push(r.totalMs);
  }
  const warmStats = summarize(warmTotal);
  const warmTtfbStats = summarize(warmTtfb);
  console.log(
    `  • 5x quentes /login: mediana=${warmStats.medianMs}ms | TTFB mediana=${warmTtfbStats.medianMs}ms | min=${warmStats.minMs}ms | max=${warmStats.maxMs}ms`
  );

  // Teste prolongado: 20 requisições com intervalo de 1s
  const prolongedSamples: number[] = [];
  let failures = 0;
  for (let i = 0; i < 20; i++) {
    try {
      const r = await singleFetch(`${baseUrl}/login`);
      prolongedSamples.push(r.totalMs);
      if (r.status !== 200) failures++;
    } catch {
      failures++;
    }
    if (i < 19) await sleep(1000);
  }
  const prolongedSummary = summarize(prolongedSamples);
  const prolongedLogin: ProlongedStats = {
    ...prolongedSummary,
    totalRequests: 20,
    successCount: 20 - failures,
    failureCount: failures,
    failureRatePct: round((failures / 20) * 100),
  };
  console.log(
    `  • Teste prolongado /login (20x, 1s): mediana=${prolongedLogin.medianMs}ms | P95=${prolongedLogin.p95Ms}ms | min=${prolongedLogin.minMs}ms | max=${prolongedLogin.maxMs}ms | falhas=${prolongedLogin.failureRatePct}%`
  );

  return { first, warmTtfb: warmTtfbStats, warmTotal: warmStats, prolonged: prolongedLogin };
}

async function collectNavigationMetrics(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];

    const jsResources = resources.filter(
      (r) => r.initiatorType === "script" || r.name.includes(".js")
    );
    const rscPrefetches = resources.filter((r) => r.name.includes("_rsc="));

    return {
      ttfbMs: nav ? Math.max(0, nav.responseStart - nav.requestStart) : 0,
      domInteractiveMs: nav ? Math.max(0, nav.domInteractive - nav.fetchStart) : 0,
      loadEventMs: nav ? Math.max(0, nav.loadEventEnd - nav.fetchStart) : 0,
      docTransferBytes: nav ? nav.transferSize || 0 : 0,
      totalResources: resources.length,
      jsRequests: jsResources.length,
      jsTransferBytes: jsResources.reduce((s, r) => s + (r.transferSize || 0), 0),
      totalTransferBytes: resources.reduce((s, r) => s + (r.transferSize || 0), 0),
      rscPrefetchRequests: rscPrefetches.length,
    };
  });
}

async function measureRouteFull(
  page: Page,
  baseUrl: string,
  route: string,
  role: string,
  expectedHeadingRegex: RegExp
): Promise<RouteAuditResult> {
  const targetUrl = `${baseUrl}${route}`;
  console.log(`  → Medindo rota ${route} (${role})...`);

  let docStatus = 0;
  const onResponse = (res: { url: () => string; status: () => number; request: () => { resourceType: () => string } }) => {
    if (res.request().resourceType() === "document" && res.url().startsWith(targetUrl)) {
      docStatus = res.status();
    }
  };
  page.on("response", onResponse);

  const t0 = performance.now();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const headingLocator = page.locator("h1").filter({ hasText: expectedHeadingRegex }).first();
  await headingLocator.waitFor({ state: "visible", timeout: 45000 });
  const usableHeadingMs = performance.now() - t0;

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const networkIdleMs = performance.now() - t0;
  page.off("response", onResponse);

  const navMetrics = await collectNavigationMetrics(page);
  const finalUrl = page.url();

  // 5 reloads consecutivos pós-compilação
  const reloadTotals: number[] = [];
  const reloadTtfbs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r0 = performance.now();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await headingLocator.waitFor({ state: "visible", timeout: 45000 });
    const rMs = performance.now() - r0;
    reloadTotals.push(rMs);

    const rm = await collectNavigationMetrics(page);
    reloadTtfbs.push(rm.ttfbMs);
  }

  const usableHeadingStats = summarize(reloadTotals);
  const ttfbStats = summarize(reloadTtfbs);

  console.log(
    `     1ª=${Math.round(usableHeadingMs)}ms (networkidle=${Math.round(networkIdleMs)}ms, RSC_prefetch=${navMetrics.rscPrefetchRequests}) | Quente(5x) mediana=${usableHeadingStats.medianMs}ms | TTFB mediana=${ttfbStats.medianMs}ms | JS=${navMetrics.jsRequests} (${Math.round(navMetrics.jsTransferBytes / 1024)} KB)`
  );

  return {
    route,
    role,
    firstVisit: {
      status: docStatus || 200,
      finalUrl,
      usableHeadingMs: round(usableHeadingMs),
      networkIdleMs: round(networkIdleMs),
      ttfbMs: round(navMetrics.ttfbMs),
      domInteractiveMs: round(navMetrics.domInteractiveMs),
      loadEventMs: round(navMetrics.loadEventMs),
      resources: {
        totalRequests: navMetrics.totalResources,
        jsRequests: navMetrics.jsRequests,
        jsTransferBytes: navMetrics.jsTransferBytes,
        totalTransferBytes: navMetrics.totalTransferBytes,
        rscPrefetchRequests: navMetrics.rscPrefetchRequests,
        docTransferBytes: navMetrics.docTransferBytes,
      },
    },
    warmReloads: {
      count: 5,
      usableHeadingStats,
      ttfbStats,
    },
  };
}

async function performBrowserLogin(
  page: Page,
  baseUrl: string,
  loginPath: string,
  email: string,
  expectedHeadingRegex: RegExp
): Promise<number> {
  await page.goto(`${baseUrl}${loginPath}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  const password = resolveSandboxPassword(email);
  const emailInput = page.getByLabel("E-mail Corporativo");
  const passwordInput = page.getByLabel("Senha de Acesso");

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.waitForTimeout(150);

  if ((await emailInput.inputValue()) !== email) {
    await emailInput.fill(email);
  }
  if ((await passwordInput.inputValue()) !== password) {
    await passwordInput.fill(password);
  }

  const t0 = performance.now();
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();

  await page
    .locator("main h1")
    .filter({ hasText: expectedHeadingRegex })
    .first()
    .waitFor({ state: "visible", timeout: 60000 });

  return round(performance.now() - t0);
}

async function measureSidebarClick(
  page: Page,
  from: string,
  toHref: string,
  label: string,
  expectedHeadingRegex: RegExp
): Promise<ClientNavStep> {
  const link = page.locator(`aside a[href="${toHref}"]`).first();
  const t0 = performance.now();
  await link.click();
  await page.locator("main h1").filter({ hasText: expectedHeadingRegex }).first().waitFor({
    state: "visible",
    timeout: 30000,
  });
  await page.waitForFunction(
    (expectedPath) => window.location.pathname === expectedPath,
    toHref,
    { timeout: 10000 }
  );
  const durationMs = round(performance.now() - t0);
  console.log(`  • Clique Sidebar "${label}" (${from} -> ${toHref}): ${durationMs}ms`);
  return { from, to: toHref, label, durationMs, finalUrl: page.url() };
}

async function benchmarkProlongedAuthenticated(
  context: BrowserContext,
  url: string
): Promise<ProlongedStats> {
  console.log(`\n--- [4] Teste Prolongado Autenticado (20x, 1s) em ${url} ---`);
  const samples: number[] = [];
  let failures = 0;

  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    try {
      const res = await context.request.get(url, { maxRedirects: 0 });
      const body = await res.text();
      const elapsed = performance.now() - t0;
      samples.push(elapsed);
      if (res.status() !== 200 || body.includes("Acesse sua conta")) {
        failures++;
      }
    } catch {
      failures++;
    }
    if (i < 19) await sleep(1000);
  }

  const stats = summarize(samples);
  const result: ProlongedStats = {
    ...stats,
    totalRequests: 20,
    successCount: 20 - failures,
    failureCount: failures,
    failureRatePct: round((failures / 20) * 100),
  };
  console.log(
    `  • Prolongado autenticado /dashboard: mediana=${result.medianMs}ms | P95=${result.p95Ms}ms | min=${result.minMs}ms | max=${result.maxMs}ms | falhas=${result.failureRatePct}%`
  );
  return result;
}

async function main() {
  const phase = parseArg("--phase=", "before");
  const port = parseArg("--port=", "3000");
  const skipDb = process.argv.includes("--skip-db");
  const baseUrl = `http://localhost:${port}`;

  console.log(`=== AUDITORIA DE PERFORMANCE LOCAL (phase=${phase}, url=${baseUrl}) ===`);

  const supabaseQueries = skipDb ? null : await benchmarkSupabaseQueries();
  const httpLogin = await benchmarkHttpLogin(baseUrl);

  console.log("\n--- [3] Navegação Real no Navegador (Playwright Chromium) ---");
  const browser = await chromium.launch({ headless: true });

  const routes: RouteAuditResult[] = [];
  const clientNavigations: ClientNavStep[] = [];
  let prolongedDashboard: ProlongedStats;

  try {
    // Contexto 1: Anônimo + Proprietário Ateliê Sandbox
    const tenantContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const tenantPage = await tenantContext.newPage();

    routes.push(
      await measureRouteFull(tenantPage, baseUrl, "/login", "Anônimo", /Acesse sua conta/i)
    );

    // Login real como owner.atelie
    const ownerEmail = "owner.atelie@sandbox.devessent.test";
    const loginFlowMs = await performBrowserLogin(
      tenantPage,
      baseUrl,
      "/login",
      ownerEmail,
      /Ateliê Sandbox/i
    );
    console.log(`  • Fluxo UI login owner.atelie -> /dashboard visível: ${loginFlowMs}ms`);

    routes.push(
      await measureRouteFull(tenantPage, baseUrl, "/dashboard", "Owner Ateliê", /Ateliê Sandbox/i)
    );
    routes.push(
      await measureRouteFull(
        tenantPage,
        baseUrl,
        "/dashboard/membros",
        "Owner Ateliê",
        /Membros do Estabelecimento/i
      )
    );
    routes.push(
      await measureRouteFull(
        tenantPage,
        baseUrl,
        "/dashboard/configuracoes",
        "Owner Ateliê",
        /Configurações do Estabelecimento/i
      )
    );
    routes.push(
      await measureRouteFull(
        tenantPage,
        baseUrl,
        "/dashboard/atividades",
        "Owner Ateliê",
        /Histórico de Atividades/i
      )
    );

    console.log("\n  [Navegação interna cliente - Tenant Sidebar]");
    await tenantPage.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await tenantPage.locator("main h1").filter({ hasText: /Ateliê Sandbox/i }).first().waitFor({ state: "visible" });
    clientNavigations.push(
      await measureSidebarClick(tenantPage, "/dashboard", "/dashboard/membros", "Membros", /Membros do Estabelecimento/i)
    );
    clientNavigations.push(
      await measureSidebarClick(
        tenantPage,
        "/dashboard/membros",
        "/dashboard/configuracoes",
        "Configurações",
        /Configurações do Estabelecimento/i
      )
    );
    clientNavigations.push(
      await measureSidebarClick(
        tenantPage,
        "/dashboard/configuracoes",
        "/dashboard/atividades",
        "Atividades",
        /Histórico de Atividades/i
      )
    );
    clientNavigations.push(
      await measureSidebarClick(
        tenantPage,
        "/dashboard/atividades",
        "/dashboard",
        "Visão Geral",
        /Ateliê Sandbox/i
      )
    );

    prolongedDashboard = await benchmarkProlongedAuthenticated(
      tenantContext,
      `${baseUrl}/dashboard`
    );

    await tenantContext.close();

    // Contexto 2: Administrador Global da Plataforma
    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminContext.newPage();

    const adminEmail = "admin.global@sandbox.devessent.test";
    const adminLoginMs = await performBrowserLogin(
      adminPage,
      baseUrl,
      "/login?redirect=/admin",
      adminEmail,
      /Painel Central de Gestão SaaS/i
    );
    console.log(`  • Fluxo UI login admin.global -> /admin visível: ${adminLoginMs}ms`);

    routes.push(
      await measureRouteFull(
        adminPage,
        baseUrl,
        "/admin",
        "Platform Admin",
        /Painel Central de Gestão SaaS/i
      )
    );
    routes.push(
      await measureRouteFull(
        adminPage,
        baseUrl,
        "/admin/empresas",
        "Platform Admin",
        /Gestão de Estabelecimentos SaaS/i
      )
    );
    routes.push(
      await measureRouteFull(
        adminPage,
        baseUrl,
        "/admin/atividades",
        "Platform Admin",
        /Histórico Global de Atividades/i
      )
    );

    console.log("\n  [Navegação interna cliente - Admin Sidebar]");
    await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    await adminPage
      .locator("main h1")
      .filter({ hasText: /Painel Central de Gestão SaaS/i })
      .first()
      .waitFor({ state: "visible" });
    clientNavigations.push(
      await measureSidebarClick(
        adminPage,
        "/admin",
        "/admin/empresas",
        "Empresas",
        /Gestão de Estabelecimentos SaaS/i
      )
    );
    clientNavigations.push(
      await measureSidebarClick(
        adminPage,
        "/admin/empresas",
        "/admin/atividades",
        "Atividades Global",
        /Histórico Global de Atividades/i
      )
    );
    clientNavigations.push(
      await measureSidebarClick(
        adminPage,
        "/admin/atividades",
        "/admin",
        "Visão Global",
        /Painel Central de Gestão SaaS/i
      )
    );

    await adminContext.close();
  } finally {
    await browser.close();
  }

  const outFile = path.resolve(process.cwd(), `docs/audit-${phase}.json`);
  const payload = {
    phase,
    timestamp: new Date().toISOString(),
    baseUrl,
    supabaseQueries,
    httpLogin,
    prolongedDashboard,
    routes,
    clientNavigations,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Resultados salvos em: ${outFile}`);
}

main().catch((err) => {
  console.error("❌ Erro na auditoria de performance:", err);
  process.exit(1);
});

