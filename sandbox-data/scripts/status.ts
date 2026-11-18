/**
 * Script de Status do Ambiente Sandbox Local.
 * - Inspeciona o estado atual dos dados fictícios no banco.
 * - Relata tenants, membros, usuários e convites.
 * - Exibe credenciais apenas se solicitado explicitamente via --show-credentials em ambiente local.
 */
import * as fs from "fs";
import * as path from "path";
import { LocalGuard } from "../lib/local-guard";
import { SandboxManifest } from "../lib/sandbox-manifest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function reportSandboxStatus(options: { showCredentials?: boolean } = {}) {
  LocalGuard.loadLocalEnv();
  LocalGuard.assertSafeEnvironment();

  const adminClient = createAdminClient();
  await LocalGuard.assertSafeDatabaseConnection(adminClient);

  console.log("===============================================================================");
  console.log("            DEVESSENT PLATFORM CORE — STATUS DO AMBIENTE SANDBOX               ");
  console.log("===============================================================================");

  // 1. Consultar Tenants do Sandbox
  const { data: tenants } = await adminClient
    .from("tenants")
    .select("id, name, slug, status, created_at, tenant_settings(display_name, contact_email)")
    .in("slug", SandboxManifest.KNOWN_SANDBOX_SLUGS as unknown as string[]);

  const tenantIds = tenants?.map((t) => t.id) || [];

  // 2. Consultar Usuários do Sandbox
  const { data: allUsers } = await adminClient.auth.admin.listUsers();
  const sandboxUsers = allUsers.users.filter(
    (u) => u.email && SandboxManifest.isSandboxEmail(u.email)
  );

  // 3. Consultar Vínculos (Memberships)
  let memberships: Array<{ tenant_id: string; user_id: string; role: string }> = [];
  if (tenantIds.length > 0) {
    const { data: mData } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id, user_id, role")
      .in("tenant_id", tenantIds);
    memberships = mData || [];
  }

  // 4. Consultar Convites
  let invitations: Array<{ tenant_id: string; email: string; role: string; status: string; expires_at: string }> = [];
  if (tenantIds.length > 0) {
    const { data: iData } = await adminClient
      .from("tenant_invitations")
      .select("tenant_id, email, role, status, expires_at")
      .in("tenant_id", tenantIds);
    invitations = iData || [];
  }

  const isProvisioned = (tenants?.length || 0) > 0 && sandboxUsers.length > 0;

  console.log(`\nEstado Geral do Sandbox: ${isProvisioned ? "🟢 PROVISIONADO & OPERACIONAL" : "⚪ LIMPO / NÃO PROVISIONADO"}`);
  console.log(`Total de Empresas Sandbox: ${tenants?.length || 0}/${SandboxManifest.KNOWN_SANDBOX_SLUGS.length}`);
  console.log(`Total de Usuários Sandbox: ${sandboxUsers.length}`);
  console.log(`Total de Vínculos: ${memberships.length}`);
  console.log(`Total de Convites Ativos/Registrados: ${invitations.length}`);

  if (tenants && tenants.length > 0) {
    console.log("\n🏢 Estabelecimentos Fictícios:");
    for (const t of tenants) {
      const tenantMembers = memberships.filter((m) => m.tenant_id === t.id);
      const settings = (t.tenant_settings as unknown as { display_name?: string }) || {};
      console.log(`  • ${t.name} (slug: ${t.slug})`);
      console.log(`    Status: ${t.status.toUpperCase()} | Nome Fantasia: ${settings.display_name || t.name}`);
      console.log(`    Membros Vinculados (${tenantMembers.length}): ${tenantMembers.map((m) => m.role).join(", ") || "Nenhum"}`);
    }
  }

  if (invitations.length > 0) {
    console.log("\n✉️ Cenários de Convites Controlados:");
    for (const inv of invitations) {
      console.log(`  • [${inv.status.toUpperCase()}] ${inv.email} (Papel: ${inv.role}, Expira: ${new Date(inv.expires_at).toLocaleDateString("pt-BR")})`);
    }
  }

  // 5. Exibição Segura de Credenciais de Teste
  console.log("\n-------------------------------------------------------------------------------");
  if (options.showCredentials) {
    const credsPath = path.resolve(process.cwd(), "sandbox-data/.credentials.local.json");
    if (fs.existsSync(credsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        console.log("🔑 CREDENCIAIS LOCAIS DE DEMONSTRAÇÃO (USO EXCLUSIVO EM DESENVOLVIMENTO):");
        console.log("-------------------------------------------------------------------------------");
        console.log("E-mail                                   | Papel                   | Senha");
        console.log("-----------------------------------------+-------------------------+-------------------");
        for (const u of creds.users) {
          const emailPadded = u.email.padEnd(40);
          const rolePadded = u.roleDescription.slice(0, 23).padEnd(23);
          console.log(`${emailPadded} | ${rolePadded} | ${u.password}`);
        }
      } catch {
        console.log("⚠️ Arquivo de credenciais locais não pôde ser lido. Execute 'pnpm sandbox:seed'.");
      }
    } else {
      console.log("⚠️ Credenciais locais não encontradas. Execute 'pnpm sandbox:seed' para gerá-las.");
    }
  } else {
    console.log("🔒 Credenciais protegidas contra exibição acidental.");
    console.log("   Para visualizar e-mails e senhas das contas no navegador, execute:");
    console.log("   👉 pnpm sandbox:status --show-credentials");
  }
  console.log("===============================================================================\n");
}

if (process.argv[1] && process.argv[1].endsWith("status.ts")) {
  const showCreds = process.argv.includes("--show-credentials") || process.argv.includes("-c");
  reportSandboxStatus({ showCredentials: showCreds }).catch((err) => {
    console.error("🛑 Erro ao gerar status do sandbox:", err.message);
    process.exit(1);
  });
}
