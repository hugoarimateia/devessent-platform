import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { ConflictError, NotFoundError } from "@/core/errors/app-error";
import { AuditService } from "@/core/audit/services/audit-service";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";
import { BillingPermissionService } from "../permissions/billing-permissions";
import {
  createBillingPlanSchema,
  updateBillingPlanSchema,
  type CreateBillingPlanInput,
  type UpdateBillingPlanInput,
} from "../schemas/billing.schema";
import type {
  BillingCycle,
  BillingPlan,
  BillingPlanHistoryItem,
} from "../types/billing.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;
type PlanRow = Database["public"]["Tables"]["billing_plans"]["Row"];
type PlanHistoryRow = Database["public"]["Tables"]["billing_plan_history"]["Row"];

function mapPlanRow(row: PlanRow, linkedCount?: number): BillingPlan {
  const rawServices = Array.isArray(row.included_services) ? row.included_services : [];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    version: row.version,
    amountCents: row.amount_cents,
    currency: "BRL",
    billingCycle: row.billing_cycle as BillingCycle,
    includedServices: rawServices.filter((s): s is string => typeof s === "string"),
    isActive: row.is_active,
    isDemo: row.is_demo,
    archivedAt: row.archived_at,
    linkedSubscriptionsCount: linkedCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanHistoryRow(row: PlanHistoryRow): BillingPlanHistoryItem {
  return {
    id: row.id,
    planId: row.plan_id,
    version: row.version,
    action: row.action as BillingPlanHistoryItem["action"],
    previousAmountCents: row.previous_amount_cents,
    newAmountCents: row.new_amount_cents,
    changedFields: (row.changed_fields as Record<string, unknown>) || {},
    reason: row.reason,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  };
}

export class BillingPlanService {
  public static async listPlans(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    includeInactive?: boolean;
  }): Promise<BillingPlan[]> {
    BillingPermissionService.assertPermission(params.actorRole, "view_global_billing");

    let query = params.supabase
      .from("billing_plans")
      .select("*")
      .order("is_active", { ascending: false })
      .order("amount_cents", { ascending: true });

    if (!params.includeInactive) {
      query = query.eq("is_active", true);
    }

    const [{ data: plans, error }, { data: subs }] = await Promise.all([
      query,
      params.supabase
        .from("billing_subscriptions")
        .select("plan_id, status")
        .neq("status", "cancelled"),
    ]);

    if (error) {
      throw new Error(`Falha ao listar planos SaaS: ${error.message}`);
    }

    const counts = new Map<string, number>();
    for (const s of subs ?? []) {
      counts.set(s.plan_id, (counts.get(s.plan_id) ?? 0) + 1);
    }

    return (plans ?? []).map((p) => mapPlanRow(p, counts.get(p.id) ?? 0));
  }

  public static async getPlanHistory(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    planId: string;
  }): Promise<BillingPlanHistoryItem[]> {
    BillingPermissionService.assertPermission(params.actorRole, "view_global_billing");

    const { data, error } = await params.supabase
      .from("billing_plan_history")
      .select("*")
      .eq("plan_id", params.planId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Falha ao consultar histórico do plano: ${error.message}`);
    }

    return (data ?? []).map(mapPlanHistoryRow);
  }

  public static async createPlan(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: CreateBillingPlanInput;
  }): Promise<BillingPlan> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_plans");
    const parsed = createBillingPlanSchema.parse(params.input);

    const { data: existing } = await params.supabase
      .from("billing_plans")
      .select("id")
      .eq("code", parsed.code)
      .maybeSingle();

    if (existing) {
      throw new ConflictError(`Já existe um plano comercial cadastrado com o código '${parsed.code}'.`);
    }

    const { data: created, error } = await params.supabase
      .from("billing_plans")
      .insert({
        code: parsed.code,
        name: parsed.name,
        description: parsed.description ?? null,
        version: 1,
        amount_cents: parsed.amountCents,
        currency: "BRL",
        billing_cycle: parsed.billingCycle,
        included_services: parsed.includedServices as unknown as Json,
        is_active: true,
        is_demo: parsed.isDemo,
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      })
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(`Erro ao criar plano SaaS: ${error?.message ?? "desconhecido"}`);
    }

    await params.supabase.from("billing_plan_history").insert({
      plan_id: created.id,
      version: 1,
      action: "created",
      previous_amount_cents: null,
      new_amount_cents: created.amount_cents,
      changed_fields: {
        code: created.code,
        name: created.name,
        billingCycle: created.billing_cycle,
      } as Json,
      reason: "Criação inicial do plano comercial",
      changed_by: params.actorUserId,
    });

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: null,
      actorUserId: params.actorUserId,
      action: "billing.plan_created",
      resourceType: "billing_plan",
      resourceId: created.id,
      metadata: {
        code: created.code,
        name: created.name,
        amountCents: created.amount_cents,
        billingCycle: created.billing_cycle,
        isDemo: created.is_demo,
      },
    });

    return mapPlanRow(created, 0);
  }

  /**
   * Atualiza um plano incrementando `version` e registrando histórico imutável.
   * REGRA CRÍTICA (§5.2): assinaturas existentes preservam seu `contracted_amount_cents`
   * e `plan_version_snapshot` intactos — nunca são alteradas silenciosamente!
   */
  public static async updatePlan(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: UpdateBillingPlanInput;
  }): Promise<BillingPlan> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_billing_plans");
    const parsed = updateBillingPlanSchema.parse(params.input);

    const { data: current, error: fetchErr } = await params.supabase
      .from("billing_plans")
      .select("*")
      .eq("id", parsed.planId)
      .maybeSingle();

    if (fetchErr || !current) {
      throw new NotFoundError("Plano comercial não encontrado.");
    }

    const nextVersion = current.version + 1;
    const nextIsActive = parsed.isActive ?? current.is_active;
    const nextAmountCents = parsed.amountCents ?? current.amount_cents;

    const { data: updated, error: updErr } = await params.supabase
      .from("billing_plans")
      .update({
        name: parsed.name ?? current.name,
        description: parsed.description !== undefined ? parsed.description : current.description,
        amount_cents: nextAmountCents,
        billing_cycle: parsed.billingCycle ?? current.billing_cycle,
        included_services:
          parsed.includedServices !== undefined
            ? (parsed.includedServices as unknown as Json)
            : current.included_services,
        is_active: nextIsActive,
        archived_at: nextIsActive ? null : current.archived_at ?? new Date().toISOString(),
        version: nextVersion,
        updated_by: params.actorUserId,
      })
      .eq("id", current.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Erro ao atualizar plano SaaS: ${updErr?.message ?? "desconhecido"}`);
    }

    const historyAction: BillingPlanHistoryItem["action"] =
      parsed.isActive === false && current.is_active
        ? "deactivated"
        : parsed.isActive === true && !current.is_active
        ? "reactivated"
        : "updated";

    await params.supabase.from("billing_plan_history").insert({
      plan_id: updated.id,
      version: nextVersion,
      action: historyAction,
      previous_amount_cents: current.amount_cents,
      new_amount_cents: updated.amount_cents,
      changed_fields: {
        nameChanged: updated.name !== current.name,
        amountChanged: updated.amount_cents !== current.amount_cents,
        cycleChanged: updated.billing_cycle !== current.billing_cycle,
        isActive: updated.is_active,
      } as Json,
      reason: parsed.reason,
      changed_by: params.actorUserId,
    });

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: null,
      actorUserId: params.actorUserId,
      action:
        historyAction === "deactivated" || historyAction === "reactivated"
          ? "billing.plan_status_changed"
          : "billing.plan_updated",
      resourceType: "billing_plan",
      resourceId: updated.id,
      metadata: {
        code: updated.code,
        version: nextVersion,
        previousAmountCents: current.amount_cents,
        newAmountCents: updated.amount_cents,
        isActive: updated.is_active,
        reason: parsed.reason,
      },
    });

    return mapPlanRow(updated);
  }
}
