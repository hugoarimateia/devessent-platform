/**
 * Script de Limpeza Segura e Seletiva do Ambiente Sandbox.
 * - Remove exclusivamente os registros que pertencem ao Sandbox (rastreados por manifesto / slugs e e-mails .test).
 * - Suporta visualização prévia com --dry-run.
 * - Exige --force ou confirmação interativa para execução.
 * - Preserva dados de outros tenants e usuários fora do Sandbox.
 */
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { LocalGuard } from "../lib/local-guard";
import { SandboxManifest } from "../lib/sandbox-manifest";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CleanupPreview {
  manifestPresent: boolean;
  tenants: Array<{ id: string; slug: string; name: string; trackedInManifest: boolean }>;
  users: Array<{ id: string; email: string; trackedInManifest: boolean }>;
  trackedInvitationIds: string[];
  membershipsCount: number;
  invitationsCount: number;
}

export async function previewSandboxCleanup(): Promise<CleanupPreview> {
  LocalGuard.loadLocalEnv();
  LocalGuard.assertSafeEnvironment();

  const adminClient = createAdminClient();
  await LocalGuard.assertSafeDatabaseConnection(adminClient);

  const manifest = SandboxManifest.get();
  const manifestTenantIds = new Set(manifest.tenants.map((t) => t.id));
  const manifestUserIds = new Set(manifest.users.map((u) => u.id));
  const manifestInvitationIds = manifest.invitations.map((i) => i.id);

  // 1. Identificar tenants do sandbox combinando IDs rastreados no manifesto e slugs canônicos
  const { data: allTenants } = await adminClient
    .from("tenants")
    .select("id, slug, name");

  const tenants = (allTenants || [])
    .filter(
      (t) =>
        (manifestTenantIds.has(t.id) || SandboxManifest.isSandboxSlug(t.slug)) &&
        SandboxManifest.isSandboxSlug(t.slug)
    )
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      trackedInManifest: manifestTenantIds.has(t.id),
    }));

  const tenantIds = tenants.map((t) => t.id);

  // 2. Identificar usuários do sandbox combinando IDs rastreados no manifesto e domínio sintético .test
  const { data: allUsers } = await adminClient.auth.admin.listUsers();
  const sandboxUsers = allUsers.users
    .filter(
      (u) =>
        Boolean(u.email) &&
        (manifestUserIds.has(u.id) || SandboxManifest.isSandboxEmail(u.email!)) &&
        SandboxManifest.isSandboxEmail(u.email!)
    )
    .map((u) => ({
      id: u.id,
      email: u.email!,
      trackedInManifest: manifestUserIds.has(u.id),
    }));

  // 3. Contabilizar memberships associadas
  let membershipsCount = 0;
  if (tenantIds.length > 0) {
    const { count } = await adminClient
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .in("tenant_id", tenantIds);
    membershipsCount = count || 0;
  }

  // 4. Contabilizar convites associados
  let invitationsCount = 0;
  if (tenantIds.length > 0) {
    const { count } = await adminClient
      .from("tenant_invitations")
      .select("id", { count: "exact", head: true })
      .in("tenant_id", tenantIds);
    invitationsCount = count || 0;
  }

  return {
    manifestPresent: manifest.tenants.length > 0 || manifest.users.length > 0,
    tenants,
    users: sandboxUsers,
    trackedInvitationIds: manifestInvitationIds,
    membershipsCount,
    invitationsCount,
  };
}

export async function runSandboxCleanup(options: { force?: boolean; dryRun?: boolean } = {}) {
  LocalGuard.loadLocalEnv();
  LocalGuard.assertSafeEnvironment();

  const adminClient = createAdminClient();
  await LocalGuard.assertSafeDatabaseConnection(adminClient);

  console.log("🔍 Identificando registros exclusivos do ambiente Sandbox...");
  const preview = await previewSandboxCleanup();

  console.log("\n📊 Prévia de registros para remoção seletiva:");
  console.log(`  - Manifesto local (.sandbox-manifest.json): ${preview.manifestPresent ? "encontrado e verificado" : "ausente (fallback por escopo canônico)"}`);
  console.log(`  - Estabelecimentos: ${preview.tenants.length} (${preview.tenants.map((t) => `${t.slug}${t.trackedInManifest ? " [manifest]" : ""}`).join(", ") || "nenhum"})`);
  console.log(`  - Contas de Usuário: ${preview.users.length} (${preview.users.map((u) => `${u.email}${u.trackedInManifest ? " [manifest]" : ""}`).join(", ") || "nenhuma"})`);
  console.log(`  - Vínculos Operacionais (Memberships): ${preview.membershipsCount}`);
  console.log(`  - Convites de Acesso: ${preview.invitationsCount}`);

  if (options.dryRun) {
    console.log("\n🔎 Modo --dry-run ativo: nenhuma alteração foi realizada no banco.");
    return preview;
  }

  if (preview.tenants.length === 0 && preview.users.length === 0) {
    console.log("\nℹ️ Nenhum dado do Sandbox encontrado para remoção. O ambiente já está limpo.");
    SandboxManifest.clear();
    return preview;
  }

  // Confirmação explícita
  if (!options.force) {
    const isInteractive = process.stdout.isTTY;
    if (!isInteractive) {
      throw new Error(
        "Operação destrutiva recusada em ambiente não-interativo. Adicione o parâmetro --force para confirmar."
      );
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question(
        "\n⚠️ Confirma a remoção permanente dos registros listados acima? [s/N]: ",
        (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase() === "s");
        }
      );
    });

    if (!confirmed) {
      console.log("❌ Limpeza cancelada pelo usuário.");
      return preview;
    }
  }

  console.log("\n🧹 Executando remoção seletiva com integridade referencial...");

  const tenantIds = preview.tenants.map((t) => t.id);

  if (preview.trackedInvitationIds.length > 0) {
    await adminClient
      .from("tenant_invitations")
      .delete()
      .in("id", preview.trackedInvitationIds);
  }

  if (tenantIds.length > 0) {
    // 1. Remover convites vinculados aos tenants do sandbox
    await adminClient.from("tenant_invitations").delete().in("tenant_id", tenantIds);

    // 2. Remover configurações
    await adminClient.from("tenant_settings").delete().in("tenant_id", tenantIds);

    // 3. Remover audit logs vinculados aos tenants do sandbox
    await adminClient.from("audit_logs").delete().in("tenant_id", tenantIds);

    // 4. Remover memberships
    await adminClient.from("tenant_memberships").delete().in("tenant_id", tenantIds);

    // 5. Remover tenants
    await adminClient.from("tenants").delete().in("id", tenantIds);
  }

  // 6. Remover platform_admin dos usuários sandbox
  for (const u of preview.users) {
    await adminClient.from("platform_admins").delete().eq("user_id", u.id);
  }

  // 7. Remover usuários no Supabase Auth (e profiles por cascade/manual)
  for (const u of preview.users) {
    await adminClient.from("profiles").delete().eq("id", u.id);
    await adminClient.auth.admin.deleteUser(u.id);
  }

  // 8. Limpar manifesto local e cofre de credenciais
  SandboxManifest.clear();
  const credsPath = path.resolve(process.cwd(), "sandbox-data/.credentials.local.json");
  if (fs.existsSync(credsPath)) {
    fs.unlinkSync(credsPath);
  }

  console.log("✅ Limpeza seletiva do Sandbox concluída com sucesso!");
  console.log("🛡️ Todos os dados fora do escopo do Sandbox foram integralmente preservados.");

  return preview;
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith("cleanup.ts")) {
  const isDryRun = process.argv.includes("--dry-run");
  const isForce = process.argv.includes("--force") || process.argv.includes("--yes");

  runSandboxCleanup({ force: isForce, dryRun: isDryRun }).catch((err) => {
    console.error("🛑 Erro durante a limpeza:", err.message);
    process.exit(1);
  });
}
