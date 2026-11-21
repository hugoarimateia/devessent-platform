import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    out[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const repoRoot = process.cwd();
const stagingEnv = parseEnvFile(path.join(repoRoot, ".env.staging.local"));
const vaultPath = path.join(repoRoot, "local-test/staging/.credentials.staging.local.json");
const hasRealStagingEnv =
  stagingEnv.NEXT_PUBLIC_SUPABASE_URL === "https://auebnppzxcvtaaqqlbts.supabase.co" &&
  Boolean(stagingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(stagingEnv.SUPABASE_SERVICE_ROLE_KEY) &&
  fs.existsSync(vaultPath);

describe.skipIf(!hasRealStagingEnv)(
  "Fase 6E.2 — Integração Real PostgreSQL/RLS: Billing SaaS e Contratos 50/50",
  () => {
    const runTag = `t6e2_${Date.now().toString(36)}`;
    let adminClient: ReturnType<typeof createClient<Database>>;
    let ownerAtelieClient: ReturnType<typeof createClient<Database>>;
    let managerAtelieClient: ReturnType<typeof createClient<Database>>;
    let staffAtelieClient: ReturnType<typeof createClient<Database>>;
    let ownerVerdeClient: ReturnType<typeof createClient<Database>>;
    let platformAdminId = "";
    let atelieId = "";
    let verdeId = "";

    const cleanupPlanIds: string[] = [];
    const cleanupSubIds: string[] = [];
    const cleanupContractIds: string[] = [];

    beforeAll(async () => {
      const vault = JSON.parse(fs.readFileSync(vaultPath, "utf-8")) as {
        accounts: Record<string, { email: string; password: string }>;
      };
      const url = stagingEnv.NEXT_PUBLIC_SUPABASE_URL;
      const anon = stagingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const service = stagingEnv.SUPABASE_SERVICE_ROLE_KEY;

      adminClient = createClient<Database>(url, service, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const signIn = async (key: string) => {
        const c = createClient<Database>(url, anon, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error } = await c.auth.signInWithPassword({
          email: vault.accounts[key].email,
          password: vault.accounts[key].password,
        });
        if (error) throw new Error(`Falha login ${key}: ${error.message}`);
        return c;
      };

      const adminUserClient = await signIn("platform_admin");
      const { data: adminUserData } = await adminUserClient.auth.getUser();
      platformAdminId = adminUserData.user?.id ?? "";

      [ownerAtelieClient, managerAtelieClient, staffAtelieClient, ownerVerdeClient] =
        await Promise.all([
          signIn("owner_atelie"),
          signIn("manager_atelie"),
          signIn("staff_atelie"),
          signIn("owner_verde"),
        ]);

      const { data: tenants } = await adminClient
        .from("tenants")
        .select("id, slug")
        .in("slug", ["atelie-demonstrativo", "verde-demonstrativo"]);
      atelieId = tenants?.find((t) => t.slug === "atelie-demonstrativo")?.id ?? "";
      verdeId = tenants?.find((t) => t.slug === "verde-demonstrativo")?.id ?? "";
      expect(atelieId).toBeTruthy();
      expect(verdeId).toBeTruthy();
    }, 30_000);

    afterAll(async () => {
      if (!adminClient) return;
      if (cleanupSubIds.length > 0) {
        await adminClient.from("billing_webhook_events").delete().in("subscription_id", cleanupSubIds);
        await adminClient.from("billing_notifications_queue").delete().in("subscription_id", cleanupSubIds);
        await adminClient.from("billing_invoice_attempts").delete().in("subscription_id", cleanupSubIds);
        await adminClient.from("billing_invoices").delete().in("subscription_id", cleanupSubIds);
        await adminClient.from("billing_subscription_history").delete().in("subscription_id", cleanupSubIds);
        await adminClient.from("billing_subscriptions").delete().in("id", cleanupSubIds);
      }
      if (cleanupContractIds.length > 0) {
        await adminClient.from("implementation_contract_history").delete().in("contract_id", cleanupContractIds);
        await adminClient.from("implementation_installments").delete().in("contract_id", cleanupContractIds);
        await adminClient.from("implementation_contracts").delete().in("id", cleanupContractIds);
      }
      if (cleanupPlanIds.length > 0) {
        await adminClient.from("billing_plan_history").delete().in("plan_id", cleanupPlanIds);
        await adminClient.from("billing_plans").delete().in("id", cleanupPlanIds);
      }
    }, 30_000);

    it("1. Isola RLS por empresa e bloqueia manager/staff e escritas diretas de owners", async () => {
      // Criar 2 planos distintos + 2 assinaturas (Ateliê e Verde) + 1 contrato 50/50 do Ateliê
      const { data: planA, error: pAErr } = await adminClient
        .from("billing_plans")
        .insert({
          code: `plano-a-${runTag}`,
          name: `Plano Demo A ${runTag}`,
          amount_cents: 14990,
          billing_cycle: "monthly",
          is_demo: true,
        })
        .select("*")
        .single();
      expect(pAErr).toBeNull();
      cleanupPlanIds.push(planA!.id);

      const { data: planB, error: pBErr } = await adminClient
        .from("billing_plans")
        .insert({
          code: `plano-b-${runTag}`,
          name: `Plano Demo B ${runTag}`,
          amount_cents: 29990,
          billing_cycle: "monthly",
          is_demo: true,
        })
        .select("*")
        .single();
      expect(pBErr).toBeNull();
      cleanupPlanIds.push(planB!.id);

      const { data: subA, error: sAErr } = await adminClient
        .from("billing_subscriptions")
        .insert({
          tenant_id: atelieId,
          plan_id: planA!.id,
          plan_name_snapshot: planA!.name,
          plan_version_snapshot: 1,
          contracted_amount_cents: 14990,
          billing_cycle: "monthly",
          status: "active",
          external_reference: `ref-a-${runTag}`,
          scheduled_start_date: "2026-11-21",
        })
        .select("*")
        .single();
      expect(sAErr).toBeNull();
      cleanupSubIds.push(subA!.id);

      const { data: subB, error: sBErr } = await adminClient
        .from("billing_subscriptions")
        .insert({
          tenant_id: verdeId,
          plan_id: planB!.id,
          plan_name_snapshot: planB!.name,
          plan_version_snapshot: 1,
          contracted_amount_cents: 29990,
          billing_cycle: "monthly",
          status: "active",
          external_reference: `ref-b-${runTag}`,
          scheduled_start_date: "2026-11-21",
        })
        .select("*")
        .single();
      expect(sBErr).toBeNull();
      cleanupSubIds.push(subB!.id);

      // Owner Ateliê vê APENAS a própria assinatura (zero dados da Verde!)
      const { data: ownerASubs } = await ownerAtelieClient
        .from("billing_subscriptions")
        .select("id, tenant_id")
        .in("id", [subA!.id, subB!.id]);
      expect(ownerASubs?.map((r) => r.id)).toEqual([subA!.id]);

      // Owner Verde vê APENAS a própria assinatura (zero dados do Ateliê!)
      const { data: ownerBSubs } = await ownerVerdeClient
        .from("billing_subscriptions")
        .select("id, tenant_id")
        .in("id", [subA!.id, subB!.id]);
      expect(ownerBSubs?.map((r) => r.id)).toEqual([subB!.id]);

      // Manager e Staff do Ateliê recebem 0 linhas (RLS bloqueia acesso comercial da DevEssent!)
      const { data: managerSubs } = await managerAtelieClient
        .from("billing_subscriptions")
        .select("id")
        .eq("id", subA!.id);
      expect(managerSubs).toEqual([]);

      const { data: staffSubs } = await staffAtelieClient
        .from("billing_subscriptions")
        .select("id")
        .eq("id", subA!.id);
      expect(staffSubs).toEqual([]);

      // Owner NÃO consegue alterar valor contratual diretamente via PostgREST/RLS
      const { data: forgedUpdate } = await ownerAtelieClient
        .from("billing_subscriptions")
        .update({ contracted_amount_cents: 100 })
        .eq("id", subA!.id)
        .select("id");
      expect(forgedUpdate ?? []).toEqual([]);

      // Owner NÃO consegue invocar RPCs financeiras exclusivas de service_role
      const { error: rpcDeniedErr } = await ownerAtelieClient.rpc("reconcile_billing_invoice_tx", {
        p_subscription_id: subA!.id,
        p_provider: "mercado_pago",
        p_external_event_id: `forged-${runTag}`,
        p_event_type: "payment.approved",
        p_signature_verified: true,
        p_billing_cycle_key: "2026-11",
        p_external_payment_id: "forged-pay",
        p_authoritative_status: "paid",
        p_amount_cents: 14990,
        p_currency: "BRL",
        p_due_date: "2026-11-21",
      });
      expect(rpcDeniedErr).not.toBeNull();
    });

    it("2. Garante reconciliação atômica, idempotência de webhook, inadimplência sem suspensão e confirmação única 50/50", async () => {
      const subId = cleanupSubIds[0];
      expect(subId).toBeTruthy();

      // 2.1 Primeira cobrança aprovada via RPC atômica
      const evtPaid = `evt-paid-${runTag}`;
      const { data: r1, error: e1 } = await adminClient.rpc("reconcile_billing_invoice_tx", {
        p_subscription_id: subId,
        p_provider: "mercado_pago",
        p_external_event_id: evtPaid,
        p_event_type: "payment.approved",
        p_signature_verified: true,
        p_billing_cycle_key: "2026-11",
        p_external_payment_id: `pay-nov-${runTag}`,
        p_authoritative_status: "paid",
        p_amount_cents: 14990,
        p_currency: "BRL",
        p_due_date: "2026-11-21",
      });
      expect(e1).toBeNull();
      expect((r1 as { outcome: string; invoiceStatus: string }).outcome).toBe("processed");
      expect((r1 as { invoiceStatus: string }).invoiceStatus).toBe("paid");

      // 2.2 Webhook duplicado -> outcome = 'duplicate', sem duplicar fatura
      const { data: rDup, error: eDup } = await adminClient.rpc("reconcile_billing_invoice_tx", {
        p_subscription_id: subId,
        p_provider: "mercado_pago",
        p_external_event_id: evtPaid,
        p_event_type: "payment.approved",
        p_signature_verified: true,
        p_billing_cycle_key: "2026-11",
        p_external_payment_id: `pay-nov-${runTag}`,
        p_authoritative_status: "paid",
        p_amount_cents: 14990,
        p_currency: "BRL",
        p_due_date: "2026-11-21",
      });
      expect(eDup).toBeNull();
      expect((rDup as { outcome: string }).outcome).toBe("duplicate");

      // 2.3 Ciclo seguinte com falha/atraso -> marca past_due mas NUNCA suspende o tenant!
      const { data: rFail, error: eFail } = await adminClient.rpc("reconcile_billing_invoice_tx", {
        p_subscription_id: subId,
        p_provider: "mercado_pago",
        p_external_event_id: `evt-overdue-${runTag}`,
        p_event_type: "payment.overdue",
        p_signature_verified: true,
        p_billing_cycle_key: "2026-12",
        p_external_payment_id: `pay-dec-${runTag}`,
        p_authoritative_status: "overdue",
        p_amount_cents: 14990,
        p_currency: "BRL",
        p_due_date: "2026-12-21",
        p_failure_code: "cc_rejected_insufficient_amount",
        p_failure_reason: "Saldo insuficiente Sandbox",
      });
      expect(eFail).toBeNull();
      expect((rFail as { subscriptionStatus: string }).subscriptionStatus).toBe("past_due");

      const { data: tenantCheck } = await adminClient
        .from("tenants")
        .select("status")
        .eq("id", atelieId)
        .single();
      expect(tenantCheck?.status).toBe("active");

      // 2.4 Contrato 50/50: confirmação atômica única da parcela de entrada
      const { data: contract, error: cErr } = await adminClient
        .from("implementation_contracts")
        .insert({
          tenant_id: atelieId,
          contract_code: `IMP-TEST-${runTag.toUpperCase()}`,
          title: "Implantação Teste 50/50",
          scope_summary: "Escopo de homologação PostgreSQL",
          total_amount_cents: 300_000,
          entry_percent: 50,
          balance_percent: 50,
          status: "awaiting_entry",
          created_by: platformAdminId,
        })
        .select("*")
        .single();
      expect(cErr).toBeNull();
      cleanupContractIds.push(contract!.id);

      const { data: inst, error: iErr } = await adminClient
        .from("implementation_installments")
        .insert({
          contract_id: contract!.id,
          tenant_id: atelieId,
          installment_kind: "entry",
          sequence_number: 1,
          label: "Entrada (50%)",
          amount_cents: 150_000,
          milestone_description: "50% antes do início",
          status: "pending",
        })
        .select("*")
        .single();
      expect(iErr).toBeNull();

      // Confirmar primeira vez -> OK e avança contrato para in_development
      const { data: conf1, error: confErr1 } = await adminClient.rpc(
        "confirm_implementation_installment_tx",
        {
          p_installment_id: inst!.id,
          p_actor_user_id: platformAdminId,
          p_reported_payment_method: "pix_manual",
          p_confirmation_note: "Pix recebido e conferido no extrato",
        }
      );
      expect(confErr1).toBeNull();
      expect((conf1 as { outcome: string; contractStatus: string }).outcome).toBe("confirmed");
      expect((conf1 as { contractStatus: string }).contractStatus).toBe("in_development");

      // Tentar confirmar segunda vez (sem mesma idempotency key) -> BLOQUEADO!
      const { error: confErr2 } = await adminClient.rpc(
        "confirm_implementation_installment_tx",
        {
          p_installment_id: inst!.id,
          p_actor_user_id: platformAdminId,
          p_reported_payment_method: "pix_manual",
          p_confirmation_note: "Tentativa de contagem dupla",
        }
      );
      expect(confErr2).not.toBeNull();
      expect(confErr2!.message).toMatch(/ALREADY_CONFIRMED/i);
    });
  }
);
