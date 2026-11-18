import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { resolveSandboxPassword } from "../sandbox-data/fixtures/users";
import { createClient } from "../src/lib/supabase/server";
import { AuthService } from "../src/core/auth/services/auth-service";
import { TenantService } from "../src/core/tenants/services/tenant-service";
import { createAdminClient } from "../src/lib/supabase/admin";

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

interface RouteBenchmark {
  route: string;
  coldTotalMs: number;
  coldTtfbMs: number;
  warmTotalMs: number;
  warmTtfbMs: number;
}

async function runBenchmark() {
  console.log("=== INICIANDO BENCHMARK DE PERFORMANCE ===");

  // 1. Benchmark de Consultas Diretas ao Supabase
  console.log("\n--- [1] Tempo das Consultas Diretas ao Supabase/PostgreSQL ---");
  const admin = createAdminClient();

  const t0Auth = performance.now();
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
    "11111111-1111-1111-1111-111111111101" // Clara Rocha
  );
  const tAuthMs = performance.now() - t0Auth;
  console.log(`⏱️ GoTrue admin.getUserById: ${tAuthMs.toFixed(2)} ms`);

  const t0Profile = performance.now();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, avatar_path, created_at")
    .eq("id", "11111111-1111-1111-1111-111111111101")
    .maybeSingle();
  const tProfileMs = performance.now() - t0Profile;
  console.log(`⏱️ Postgres SELECT profiles: ${tProfileMs.toFixed(2)} ms`);

  const t0Tenants = performance.now();
  const userTenants = await TenantService.listUserTenants(
    admin,
    "11111111-1111-1111-1111-111111111101"
  );
  const tTenantsMs = performance.now() - t0Tenants;
  console.log(`⏱️ Postgres listUserTenants: ${tTenantsMs.toFixed(2)} ms (encontrados: ${userTenants.length})`);

  let tContextMs = 0;
  if (userTenants.length > 0) {
    const t0Context = performance.now();
    await TenantService.resolveTenantContext(
      admin,
      "11111111-1111-1111-1111-111111111101",
      userTenants[0].tenantId
    );
    tContextMs = performance.now() - t0Context;
    console.log(`⏱️ Postgres resolveTenantContext: ${tContextMs.toFixed(2)} ms`);
  }

  // 2. Benchmark de Navegação no Navegador (Cold vs Warm)
  console.log("\n--- [2] Tempo de Navegação no Navegador (Cold vs Warm) ---");
  const browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await browserContext.newPage();

  const results: RouteBenchmark[] = [];

  // A. Rota /login (sem autenticação)
  console.log("\nMedindo: /login ...");
  const cold0 = performance.now();
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 60000 });
  const coldLoginMs = performance.now() - cold0;

  const warm0 = performance.now();
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 60000 });
  const warmLoginMs = performance.now() - warm0;

  results.push({
    route: "/login",
    coldTotalMs: Math.round(coldLoginMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmLoginMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /login: Cold = ${Math.round(coldLoginMs)} ms | Warm = ${Math.round(warmLoginMs)} ms`);

  // Autenticar com o proprietário do Ateliê
  console.log("\nAutenticando usuário owner.atelie...");
  await page.getByLabel("E-mail Corporativo").fill("owner.atelie@sandbox.devessent.test");
  await page
    .getByLabel("Senha de Acesso")
    .fill(resolveSandboxPassword("owner.atelie@sandbox.devessent.test"));
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });

  // B. Rota /dashboard
  console.log("Medindo: /dashboard ...");
  const coldDash0 = performance.now();
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 60000 });
  const coldDashMs = performance.now() - coldDash0;

  const warmDash0 = performance.now();
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 60000 });
  const warmDashMs = performance.now() - warmDash0;

  results.push({
    route: "/dashboard",
    coldTotalMs: Math.round(coldDashMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmDashMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /dashboard: Cold = ${Math.round(coldDashMs)} ms | Warm = ${Math.round(warmDashMs)} ms`);

  // C. Rota /dashboard/membros
  console.log("Medindo: /dashboard/membros ...");
  const coldMembros0 = performance.now();
  await page.goto("http://localhost:3000/dashboard/membros", { waitUntil: "networkidle", timeout: 60000 });
  const coldMembrosMs = performance.now() - coldMembros0;

  const warmMembros0 = performance.now();
  await page.goto("http://localhost:3000/dashboard/membros", { waitUntil: "networkidle", timeout: 60000 });
  const warmMembrosMs = performance.now() - warmMembros0;

  results.push({
    route: "/dashboard/membros",
    coldTotalMs: Math.round(coldMembrosMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmMembrosMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /dashboard/membros: Cold = ${Math.round(coldMembrosMs)} ms | Warm = ${Math.round(warmMembrosMs)} ms`);

  // D. Rota /dashboard/configuracoes
  console.log("Medindo: /dashboard/configuracoes ...");
  const coldConf0 = performance.now();
  await page.goto("http://localhost:3000/dashboard/configuracoes", { waitUntil: "networkidle", timeout: 60000 });
  const coldConfMs = performance.now() - coldConf0;

  const warmConf0 = performance.now();
  await page.goto("http://localhost:3000/dashboard/configuracoes", { waitUntil: "networkidle", timeout: 60000 });
  const warmConfMs = performance.now() - warmConf0;

  results.push({
    route: "/dashboard/configuracoes",
    coldTotalMs: Math.round(coldConfMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmConfMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /dashboard/configuracoes: Cold = ${Math.round(coldConfMs)} ms | Warm = ${Math.round(warmConfMs)} ms`);

  // E. Autenticar como Admin da Plataforma para /admin e /admin/atividades
  console.log("\nAutenticando usuário admin.geral...");
  await browserContext.clearCookies();
  await page.goto("http://localhost:3000/login?redirect=/admin", { waitUntil: "networkidle", timeout: 60000 });
  await page.getByLabel("E-mail Corporativo").fill("admin.geral@sandbox.devessent.test");
  await page
    .getByLabel("Senha de Acesso")
    .fill(resolveSandboxPassword("admin.geral@sandbox.devessent.test"));
  await page.getByRole("button", { name: "Entrar na Plataforma" }).click();
  await page.waitForURL("**/admin", { timeout: 60000 });

  // F. Rota /admin
  console.log("Medindo: /admin ...");
  const coldAdmin0 = performance.now();
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle", timeout: 60000 });
  const coldAdminMs = performance.now() - coldAdmin0;

  const warmAdmin0 = performance.now();
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle", timeout: 60000 });
  const warmAdminMs = performance.now() - warmAdmin0;

  results.push({
    route: "/admin",
    coldTotalMs: Math.round(coldAdminMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmAdminMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /admin: Cold = ${Math.round(coldAdminMs)} ms | Warm = ${Math.round(warmAdminMs)} ms`);

  // G. Rota /admin/atividades
  console.log("Medindo: /admin/atividades ...");
  const coldAtiv0 = performance.now();
  await page.goto("http://localhost:3000/admin/atividades", { waitUntil: "networkidle", timeout: 60000 });
  const coldAtivMs = performance.now() - coldAtiv0;

  const warmAtiv0 = performance.now();
  await page.goto("http://localhost:3000/admin/atividades", { waitUntil: "networkidle", timeout: 60000 });
  const warmAtivMs = performance.now() - warmAtiv0;

  results.push({
    route: "/admin/atividades",
    coldTotalMs: Math.round(coldAtivMs),
    coldTtfbMs: 0,
    warmTotalMs: Math.round(warmAtivMs),
    warmTtfbMs: 0,
  });
  console.log(`  -> /admin/atividades: Cold = ${Math.round(coldAtivMs)} ms | Warm = ${Math.round(warmAtivMs)} ms`);

  await browser.close();

  console.log("\n=======================================================");
  console.log("TABELA DE RESULTADOS DO BENCHMARK");
  console.log("=======================================================");
  console.table(results);

  // Salvar em arquivo para o relatório
  const isOptimized = process.argv.includes("--optimized");
  const fileName = isOptimized
    ? "docs/benchmark-optimized.json"
    : "docs/benchmark-baseline.json";

  fs.writeFileSync(
    path.resolve(process.cwd(), fileName),
    JSON.stringify(
      {
        supabaseQueries: {
          getUserByIdMs: tAuthMs,
          profileSelectMs: tProfileMs,
          listUserTenantsMs: tTenantsMs,
          resolveTenantContextMs: tContextMs,
        },
        routeBenchmarks: results,
      },
      null,
      2
    )
  );
  console.log(`Arquivo salvo: ${fileName}`);
}

runBenchmark().catch((err) => {
  console.error("Erro no benchmark:", err);
  process.exit(1);
});
