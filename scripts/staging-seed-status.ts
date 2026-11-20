/**
 * Verifica de forma somente-leitura o estado dos dados demonstrativos no
 * Supabase Cloud Staging autorizado (auebnppzxcvtaaqqlbts).
 * Nunca imprime senhas, tokens ou chaves secretas.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import type { Database } from "../src/types/database.types";
import {
  AUTHORIZED_STAGING_ORG_NAME,
  AUTHORIZED_STAGING_PROJECT_NAME,
  loadAndValidateStagingEnv,
} from "./lib/staging-env";

const CREDENTIALS_VAULT_REL_PATH = "local-test/staging/.credentials.staging.local.json";
const DEMO_SLUGS = ["atelie-demonstrativo", "verde-demonstrativo"];

async function main() {
  const validated = loadAndValidateStagingEnv({ requireServiceRole: true });
  const admin = createClient<Database>(validated.supabaseUrl, validated.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("📊 Status dos Dados Demonstrativos — Supabase Cloud Staging");
  console.log(`   Organização : ${AUTHORIZED_STAGING_ORG_NAME}`);
  console.log(`   Projeto     : ${AUTHORIZED_STAGING_PROJECT_NAME} (${validated.projectRef})`);
  console.log(`   Host        : ${validated.supabaseHost}\n`);

  const { data: tenants, error: tErr } = await admin
    .from("tenants")
    .select("id, name, slug, status")
    .in("slug", DEMO_SLUGS)
    .order("slug");

  if (tErr) throw new Error(`Erro ao consultar tenants: ${tErr.message}`);

  if (!tenants || tenants.length === 0) {
    console.log("⚠️ Nenhuma empresa demonstrativa encontrada. Execute: pnpm staging:seed");
    process.exit(0);
  }

  for (const t of tenants) {
    const [storeRes, catRes, prodRes, varRes, imgRes, memRes, ordRes, payConnRes, payRes] =
      await Promise.all([
        admin.from("retail_stores").select("id, template, is_active, slug").eq("tenant_id", t.id).maybeSingle(),
        admin.from("retail_categories").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("retail_products").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("retail_variants").select("id, stock_quantity").eq("tenant_id", t.id),
        admin.from("retail_product_images").select("id, storage_path").eq("tenant_id", t.id),
        admin.from("tenant_memberships").select("role").eq("tenant_id", t.id),
        admin.from("retail_orders").select("order_number, status, payment_status, stock_deducted").eq("tenant_id", t.id).order("order_number"),
        admin.from("retail_payment_connections").select("provider, environment, status, seller_account_id").eq("tenant_id", t.id).maybeSingle(),
        admin.from("retail_payments").select("status, environment").eq("tenant_id", t.id),
      ]);

    const totalStock = (varRes.data || []).reduce((acc, v) => acc + v.stock_quantity, 0);
    const rolesSummary = (memRes.data || []).reduce<Record<string, number>>((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});
    const ordersByStatus = (ordRes.data || []).reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`🏢 ${t.name} (/${t.slug}) — status: ${t.status}`);
    console.log(
      `   Vitrine     : template=${storeRes.data?.template || "n/a"}, ativa=${Boolean(storeRes.data?.is_active)}, URL=${validated.appUrl}/loja/${storeRes.data?.slug || t.slug}`
    );
    console.log(
      `   Catálogo    : ${catRes.count || 0} categorias | ${prodRes.count || 0} produtos | ${varRes.data?.length || 0} variantes (estoque total: ${totalStock}) | ${imgRes.data?.length || 0} imagens Storage`
    );
    console.log(`   Membros     : ${JSON.stringify(rolesSummary)}`);
    console.log(`   Pedidos     : ${(ordRes.data || []).length} total -> ${JSON.stringify(ordersByStatus)}`);
    console.log(
      `   Pagamentos  : conexão=${payConnRes.data ? `${payConnRes.data.provider}/${payConnRes.data.environment}/${payConnRes.data.status} (${payConnRes.data.seller_account_id})` : "não configurada"} | registros=${payRes.data?.length || 0}`
    );
    console.log("");
  }

  const { count: adminCount } = await admin
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  const { count: profileCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const vaultPath = path.resolve(process.cwd(), CREDENTIALS_VAULT_REL_PATH);
  const vaultExists = fs.existsSync(vaultPath);
  let vaultEmails: string[] = [];
  if (vaultExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf-8")) as {
        accounts?: Record<string, { email: string; roleSummary: string }>;
      };
      vaultEmails = Object.values(parsed.accounts || {}).map(
        (a) => `   - ${a.email} (${a.roleSummary})`
      );
    } catch {
      // ignora
    }
  }

  console.log(`👥 Perfis no banco: ${profileCount || 0} | Platform Admins: ${adminCount || 0}`);
  console.log(
    `🔐 Arquivo local de credenciais: ${CREDENTIALS_VAULT_REL_PATH} (${vaultExists ? "disponível" : "ausente"})`
  );
  if (vaultEmails.length > 0) {
    console.log("   Contas registradas (senhas mantidas exclusivamente no arquivo local):");
    for (const line of vaultEmails) console.log(line);
  }
}

main().catch((err) => {
  console.error(`❌ Erro ao consultar staging:seed:status: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
