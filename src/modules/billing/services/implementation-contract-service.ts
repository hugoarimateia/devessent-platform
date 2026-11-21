import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors/app-error";
import { AuditService } from "@/core/audit/services/audit-service";
import type { RoleOrAdmin } from "@/core/permissions/policies/role-matrix";
import { BillingInvariants } from "../domain/billing-invariants";
import { BillingPermissionService } from "../permissions/billing-permissions";
import {
  confirmImplementationInstallmentSchema,
  createImplementationContractSchema,
  updateImplementationContractActionSchema,
  type ConfirmImplementationInstallmentInput,
  type CreateImplementationContractInput,
  type UpdateImplementationContractActionInput,
} from "../schemas/billing.schema";
import type {
  ImplementationContract,
  ImplementationContractHistoryItem,
  ImplementationContractStatus,
  ImplementationInstallment,
  ImplementationInstallmentStatus,
  ManualPaymentMethod,
} from "../types/billing.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;
type ContractRow = Database["public"]["Tables"]["implementation_contracts"]["Row"];
type InstallmentRow = Database["public"]["Tables"]["implementation_installments"]["Row"];
type HistoryRow = Database["public"]["Tables"]["implementation_contract_history"]["Row"];

function mapInstallment(row: InstallmentRow): ImplementationInstallment {
  return {
    id: row.id,
    contractId: row.contract_id,
    tenantId: row.tenant_id,
    installmentKind: row.installment_kind as ImplementationInstallment["installmentKind"],
    sequenceNumber: row.sequence_number,
    label: row.label,
    amountCents: row.amount_cents,
    currency: "BRL",
    dueDate: row.due_date,
    milestoneDescription: row.milestone_description,
    status: row.status as ImplementationInstallmentStatus,
    reportedPaymentMethod: row.reported_payment_method as ManualPaymentMethod | null,
    receiptStoragePath: row.receipt_storage_path,
    receiptFileName: row.receipt_file_name,
    receiptMimeType: row.receipt_mime_type,
    receiptSizeBytes: row.receipt_size_bytes,
    receiptAttachedAt: row.receipt_attached_at,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    confirmationNote: row.confirmation_note,
    createdAt: row.created_at,
  };
}

function mapHistory(row: HistoryRow): ImplementationContractHistoryItem {
  return {
    id: row.id,
    contractId: row.contract_id,
    installmentId: row.installment_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapContract(
  row: ContractRow,
  installments: ImplementationInstallment[],
  tenantMeta?: { name: string; slug: string },
  history?: ImplementationContractHistoryItem[]
): ImplementationContract {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: tenantMeta?.name,
    tenantSlug: tenantMeta?.slug,
    contractCode: row.contract_code,
    title: row.title,
    scopeSummary: row.scope_summary,
    totalAmountCents: row.total_amount_cents,
    entryPercent: row.entry_percent,
    balancePercent: row.balance_percent,
    currency: "BRL",
    status: row.status as ImplementationContractStatus,
    customTermsNote: row.custom_terms_note,
    acceptedAt: row.accepted_at,
    acceptedByName: row.accepted_by_name,
    projectStartedAt: row.project_started_at,
    deliveryConfirmedAt: row.delivery_confirmed_at,
    deliveryConfirmedBy: row.delivery_confirmed_by,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    installments,
    history,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fluxo C — Contratos de Implantação 50/50 (recebimento manual auditado).
 * Totalmente independente das mensalidades SaaS e dos pagamentos Retail.
 */
export class ImplementationContractService {
  public static async listGlobalContracts(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
  }): Promise<ImplementationContract[]> {
    BillingPermissionService.assertPermission(params.actorRole, "view_global_billing");

    const [{ data: contracts, error }, { data: installments }, { data: tenants }, { data: history }] =
      await Promise.all([
        params.supabase
          .from("implementation_contracts")
          .select("*")
          .order("created_at", { ascending: false }),
        params.supabase
          .from("implementation_installments")
          .select("*")
          .order("sequence_number", { ascending: true }),
        params.supabase.from("tenants").select("id, name, slug"),
        params.supabase
          .from("implementation_contract_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    if (error) {
      throw new Error(`Falha ao listar contratos de implantação: ${error.message}`);
    }

    const tenantMap = new Map((tenants ?? []).map((t) => [t.id, { name: t.name, slug: t.slug }]));
    const instByContract = new Map<string, ImplementationInstallment[]>();
    for (const row of installments ?? []) {
      const list = instByContract.get(row.contract_id) ?? [];
      list.push(mapInstallment(row));
      instByContract.set(row.contract_id, list);
    }

    const histByContract = new Map<string, ImplementationContractHistoryItem[]>();
    for (const row of history ?? []) {
      const list = histByContract.get(row.contract_id) ?? [];
      list.push(mapHistory(row));
      histByContract.set(row.contract_id, list);
    }

    return (contracts ?? []).map((c) =>
      mapContract(
        c,
        instByContract.get(c.id) ?? [],
        tenantMap.get(c.tenant_id),
        histByContract.get(c.id) ?? []
      )
    );
  }

  public static async listTenantContracts(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    tenantId: string;
  }): Promise<ImplementationContract[]> {
    BillingPermissionService.assertPermission(params.actorRole, "view_own_tenant_billing");

    const [{ data: contracts, error }, { data: installments }] = await Promise.all([
      params.supabase
        .from("implementation_contracts")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false }),
      params.supabase
        .from("implementation_installments")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("sequence_number", { ascending: true }),
    ]);

    if (error) {
      throw new Error(`Falha ao consultar contratos de implantação do cliente: ${error.message}`);
    }

    const instByContract = new Map<string, ImplementationInstallment[]>();
    for (const row of installments ?? []) {
      const list = instByContract.get(row.contract_id) ?? [];
      list.push(mapInstallment(row));
      instByContract.set(row.contract_id, list);
    }

    return (contracts ?? []).map((c) => mapContract(c, instByContract.get(c.id) ?? []));
  }

  public static async createContract(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: CreateImplementationContractInput;
  }): Promise<ImplementationContract> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_implementation_contracts");
    const parsed = createImplementationContractSchema.parse(params.input);

    if (parsed.entryPercent !== 50 && (!parsed.customTermsNote || parsed.customTermsNote.length < 5)) {
      throw new ValidationError(
        "Condições diferentes do padrão 50%/50% exigem registro explícito da justificativa contratual."
      );
    }

    const split = BillingInvariants.calculateImplementationSplit(
      parsed.totalAmountCents,
      parsed.entryPercent
    );

    const { data: tenant } = await params.supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", parsed.tenantId)
      .maybeSingle();

    if (!tenant) {
      throw new NotFoundError("Empresa contratante não localizada.");
    }

    const contractCode = `IMP-${new Date().toISOString().slice(0, 7).replace("-", "")}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    const initialStatus: ImplementationContractStatus =
      split.entryCents > 0 ? "awaiting_entry" : "in_development";

    const { data: created, error } = await params.supabase
      .from("implementation_contracts")
      .insert({
        tenant_id: parsed.tenantId,
        contract_code: contractCode,
        title: parsed.title,
        scope_summary: parsed.scopeSummary,
        total_amount_cents: parsed.totalAmountCents,
        entry_percent: split.entryPercent,
        balance_percent: split.balancePercent,
        currency: "BRL",
        status: initialStatus,
        custom_terms_note: parsed.customTermsNote ?? null,
        accepted_at: parsed.acceptedByName ? new Date().toISOString() : null,
        accepted_by_name: parsed.acceptedByName ?? null,
        created_by: params.actorUserId,
      })
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(`Falha ao criar contrato de implantação: ${error?.message ?? "desconhecido"}`);
    }

    const installmentsToInsert: Array<
      Database["public"]["Tables"]["implementation_installments"]["Insert"]
    > = [];
    let seq = 1;

    if (split.entryCents > 0) {
      installmentsToInsert.push({
        contract_id: created.id,
        tenant_id: created.tenant_id,
        installment_kind: "entry",
        sequence_number: seq++,
        label: `Entrada (${split.entryPercent}%)`,
        amount_cents: split.entryCents,
        currency: "BRL",
        due_date: parsed.entryDueDate ?? null,
        milestone_description: parsed.entryMilestone,
        status: "pending",
      });
    }

    if (split.balanceCents > 0) {
      installmentsToInsert.push({
        contract_id: created.id,
        tenant_id: created.tenant_id,
        installment_kind: "balance",
        sequence_number: seq++,
        label: `Saldo na entrega (${split.balancePercent}%)`,
        amount_cents: split.balanceCents,
        currency: "BRL",
        due_date: parsed.balanceDueDate ?? null,
        milestone_description: parsed.balanceMilestone,
        status: "pending",
      });
    }

    const { data: insertedInsts, error: instErr } = await params.supabase
      .from("implementation_installments")
      .insert(installmentsToInsert)
      .select("*");

    if (instErr || !insertedInsts) {
      throw new Error(`Falha ao gerar parcelas 50/50 do contrato: ${instErr?.message ?? ""}`);
    }

    await params.supabase.from("implementation_contract_history").insert({
      contract_id: created.id,
      installment_id: null,
      tenant_id: created.tenant_id,
      action: "contract_created",
      actor_user_id: params.actorUserId,
      note: `Contrato ${contractCode} criado (${split.entryPercent}%/${split.balancePercent}% · ${BillingInvariants.formatCentsToBrl(created.total_amount_cents)}).`,
      metadata: {
        entryCents: split.entryCents,
        balanceCents: split.balanceCents,
      } as Json,
    });

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: created.tenant_id,
      actorUserId: params.actorUserId,
      action: "billing.contract_created",
      resourceType: "implementation_contract",
      resourceId: created.id,
      metadata: {
        contractCode,
        totalAmountCents: created.total_amount_cents,
        entryPercent: split.entryPercent,
        balancePercent: split.balancePercent,
      },
    });

    return mapContract(
      created,
      insertedInsts.map(mapInstallment),
      { name: tenant.name, slug: tenant.slug }
    );
  }

  /**
   * Anexa comprovante validado ao bucket privado `billing-receipts`.
   * REGRA CRÍTICA (§10): anexar comprovante marca `status = 'receipt_attached'` e NÃO confirma
   * automaticamente o recebimento financeiro!
   */
  public static async attachInstallmentReceipt(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    installmentId: string;
    fileBuffer: Buffer;
    fileName: string;
    reportedPaymentMethod?: ManualPaymentMethod;
  }): Promise<ImplementationInstallment> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_implementation_contracts");

    const checked = BillingInvariants.validateReceiptFileBuffer(params.fileBuffer, params.fileName);

    const { data: inst, error: fetchErr } = await params.supabase
      .from("implementation_installments")
      .select("*")
      .eq("id", params.installmentId)
      .maybeSingle();

    if (fetchErr || !inst) {
      throw new NotFoundError("Parcela de implantação não localizada.");
    }
    if (inst.status === "cancelled") {
      throw new ConflictError("Não é possível anexar comprovante a uma parcela cancelada.");
    }

    const storagePath = `${inst.tenant_id}/${inst.contract_id}/${inst.id}-${Date.now()}.${checked.extension}`;
    const admin = createAdminClient();
    const { error: uploadErr } = await admin.storage
      .from("billing-receipts")
      .upload(storagePath, params.fileBuffer, {
        contentType: checked.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Falha ao armazenar comprovante no Storage privado: ${uploadErr.message}`);
    }

    // Preserva status 'confirmed' se já confirmado; caso pendente, avança APENAS para 'receipt_attached'
    const nextStatus: ImplementationInstallmentStatus =
      inst.status === "confirmed" ? "confirmed" : "receipt_attached";

    const { data: updated, error: updErr } = await params.supabase
      .from("implementation_installments")
      .update({
        status: nextStatus,
        reported_payment_method: params.reportedPaymentMethod ?? inst.reported_payment_method,
        receipt_storage_path: storagePath,
        receipt_file_name: checked.safeFileName,
        receipt_mime_type: checked.mimeType,
        receipt_size_bytes: checked.sizeBytes,
        receipt_sha256: checked.sha256,
        receipt_attached_at: new Date().toISOString(),
        receipt_attached_by: params.actorUserId,
      })
      .eq("id", inst.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`Falha ao vincular comprovante à parcela: ${updErr?.message ?? ""}`);
    }

    await params.supabase.from("implementation_contract_history").insert({
      contract_id: inst.contract_id,
      installment_id: inst.id,
      tenant_id: inst.tenant_id,
      action: "receipt_attached",
      actor_user_id: params.actorUserId,
      note: `Comprovante anexado (${checked.safeFileName}) — aguardando confirmação explícita de recebimento.`,
      metadata: {
        fileName: checked.safeFileName,
        mimeType: checked.mimeType,
        sizeBytes: checked.sizeBytes,
        sha256: checked.sha256,
      } as Json,
    });

    await AuditService.recordEvent({
      supabase: params.supabase,
      tenantId: inst.tenant_id,
      actorUserId: params.actorUserId,
      action: "billing.installment_receipt_attached",
      resourceType: "implementation_installment",
      resourceId: inst.id,
      metadata: {
        contractId: inst.contract_id,
        fileName: checked.safeFileName,
        sha256: checked.sha256,
      },
    });

    return mapInstallment(updated);
  }

  /**
   * Confirma recebimento manual de uma parcela via RPC transacional atômica e idempotente.
   * Impede contagem dupla de recebimento (§10).
   */
  public static async confirmInstallmentReceived(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: ConfirmImplementationInstallmentInput;
    idempotencyKey?: string;
  }): Promise<{ outcome: string; installmentId: string; contractId: string }> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_implementation_contracts");
    const parsed = confirmImplementationInstallmentSchema.parse(params.input);

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("confirm_implementation_installment_tx", {
      p_installment_id: parsed.installmentId,
      p_actor_user_id: params.actorUserId,
      p_reported_payment_method: parsed.reportedPaymentMethod,
      p_confirmation_note: parsed.confirmationNote,
      p_idempotency_key: params.idempotencyKey ?? undefined,
    });

    if (error) {
      if (error.message.includes("IMPLEMENTATION_INSTALLMENT_ALREADY_CONFIRMED")) {
        throw new ConflictError("Esta parcela já teve seu recebimento confirmado anteriormente.");
      }
      if (error.message.includes("IMPLEMENTATION_INSTALLMENT_NOT_FOUND")) {
        throw new NotFoundError("Parcela de implantação não localizada.");
      }
      if (error.message.includes("CANCELLED")) {
        throw new ConflictError("Não é possível confirmar parcela de contrato cancelado.");
      }
      throw new Error(`Falha ao confirmar recebimento da parcela: ${error.message}`);
    }

    const resObj = (data ?? {}) as { outcome?: string; installmentId?: string; contractId?: string };

    const { data: inst } = await admin
      .from("implementation_installments")
      .select("tenant_id, amount_cents, label")
      .eq("id", parsed.installmentId)
      .maybeSingle();

    if (resObj.outcome === "confirmed") {
      await AuditService.recordEvent({
        supabase: admin,
        tenantId: inst?.tenant_id ?? null,
        actorUserId: params.actorUserId,
        action: "billing.installment_confirmed",
        resourceType: "implementation_installment",
        resourceId: parsed.installmentId,
        metadata: {
          contractId: resObj.contractId,
          label: inst?.label,
          amountCents: inst?.amount_cents,
          reportedPaymentMethod: parsed.reportedPaymentMethod,
          confirmationNote: parsed.confirmationNote,
        },
      });
    }

    return {
      outcome: resObj.outcome ?? "confirmed",
      installmentId: resObj.installmentId ?? parsed.installmentId,
      contractId: resObj.contractId ?? "",
    };
  }

  public static async applyContractLifecycleAction(params: {
    supabase: AppSupabaseClient;
    actorRole: RoleOrAdmin;
    actorUserId: string;
    input: UpdateImplementationContractActionInput;
  }): Promise<{ contractId: string; status: ImplementationContractStatus }> {
    BillingPermissionService.assertPermission(params.actorRole, "manage_implementation_contracts");
    const parsed = updateImplementationContractActionSchema.parse(params.input);

    const { data: contract, error } = await params.supabase
      .from("implementation_contracts")
      .select("*")
      .eq("id", parsed.contractId)
      .maybeSingle();

    if (error || !contract) {
      throw new NotFoundError("Contrato de implantação não encontrado.");
    }

    const { data: installments } = await params.supabase
      .from("implementation_installments")
      .select("*")
      .eq("contract_id", contract.id)
      .order("sequence_number", { ascending: true });

    let nextStatus = contract.status as ImplementationContractStatus;

    if (parsed.action === "start_project") {
      if (contract.status === "cancelled" || contract.status === "completed") {
        throw new ConflictError("Contrato em estado terminal não pode ser iniciado.");
      }
      nextStatus = "in_development";
      await params.supabase
        .from("implementation_contracts")
        .update({
          status: nextStatus,
          project_started_at: contract.project_started_at ?? new Date().toISOString(),
        })
        .eq("id", contract.id);

      await params.supabase.from("implementation_contract_history").insert({
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        action: "project_started",
        actor_user_id: params.actorUserId,
        note: parsed.note,
      });
    } else if (parsed.action === "confirm_delivery") {
      if (contract.status === "cancelled") {
        throw new ConflictError("Contrato cancelado não pode ter entrega confirmada.");
      }
      const hasUnconfirmedInstallments = (installments ?? []).some(
        (i) => i.status !== "confirmed" && i.status !== "cancelled"
      );
      nextStatus = hasUnconfirmedInstallments ? "delivered_awaiting_balance" : "completed";
      const nowIso = new Date().toISOString();

      await params.supabase
        .from("implementation_contracts")
        .update({
          status: nextStatus,
          delivery_confirmed_at: nowIso,
          delivery_confirmed_by: params.actorUserId,
          completed_at: nextStatus === "completed" ? nowIso : null,
        })
        .eq("id", contract.id);

      await params.supabase.from("implementation_contract_history").insert({
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        action: "delivery_confirmed",
        actor_user_id: params.actorUserId,
        note: parsed.note,
        metadata: { nextStatus } as Json,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: contract.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.contract_delivery_confirmed",
        resourceType: "implementation_contract",
        resourceId: contract.id,
        metadata: { contractCode: contract.contract_code, nextStatus, note: parsed.note },
      });
    } else if (parsed.action === "cancel") {
      nextStatus = "cancelled";
      await params.supabase
        .from("implementation_contracts")
        .update({
          status: nextStatus,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: parsed.note,
        })
        .eq("id", contract.id);

      await params.supabase
        .from("implementation_installments")
        .update({ status: "cancelled" })
        .eq("contract_id", contract.id)
        .neq("status", "confirmed");

      await params.supabase.from("implementation_contract_history").insert({
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        action: "contract_cancelled",
        actor_user_id: params.actorUserId,
        note: parsed.note,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: contract.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.contract_updated",
        resourceType: "implementation_contract",
        resourceId: contract.id,
        metadata: { contractCode: contract.contract_code, status: "cancelled", note: parsed.note },
      });
    } else if (parsed.action === "admin_correction") {
      const confirmedTotal = (installments ?? [])
        .filter((i) => i.status === "confirmed")
        .reduce((acc, i) => acc + i.amount_cents, 0);

      if (parsed.newTotalAmountCents !== undefined) {
        if (parsed.newTotalAmountCents < confirmedTotal) {
          throw new ValidationError(
            "Novo valor total não pode ser inferior ao montante já recebido e confirmado."
          );
        }
        const pendingInsts = (installments ?? []).filter(
          (i) => i.status !== "confirmed" && i.status !== "cancelled"
        );
        if (pendingInsts.length === 0 && parsed.newTotalAmountCents !== contract.total_amount_cents) {
          throw new ConflictError(
            "Não há parcelas pendentes para absorver a correção administrativa de valor."
          );
        }

        await params.supabase
          .from("implementation_contracts")
          .update({ total_amount_cents: parsed.newTotalAmountCents })
          .eq("id", contract.id);

        if (pendingInsts.length === 1) {
          const adjusted = parsed.newTotalAmountCents - confirmedTotal;
          if (adjusted > 0) {
            await params.supabase
              .from("implementation_installments")
              .update({ amount_cents: adjusted })
              .eq("id", pendingInsts[0].id);
          }
        } else if (pendingInsts.length === 2 && confirmedTotal === 0) {
          const resplit = BillingInvariants.calculateImplementationSplit(
            parsed.newTotalAmountCents,
            contract.entry_percent
          );
          await params.supabase
            .from("implementation_installments")
            .update({ amount_cents: resplit.entryCents })
            .eq("id", pendingInsts[0].id);
          await params.supabase
            .from("implementation_installments")
            .update({ amount_cents: resplit.balanceCents })
            .eq("id", pendingInsts[1].id);
        }
      }

      await params.supabase.from("implementation_contract_history").insert({
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        action: "admin_correction",
        actor_user_id: params.actorUserId,
        note: parsed.note,
        metadata: {
          previousTotalAmountCents: contract.total_amount_cents,
          newTotalAmountCents: parsed.newTotalAmountCents ?? contract.total_amount_cents,
        } as Json,
      });

      await AuditService.recordEvent({
        supabase: params.supabase,
        tenantId: contract.tenant_id,
        actorUserId: params.actorUserId,
        action: "billing.contract_updated",
        resourceType: "implementation_contract",
        resourceId: contract.id,
        metadata: {
          contractCode: contract.contract_code,
          action: "admin_correction",
          previousTotalAmountCents: contract.total_amount_cents,
          newTotalAmountCents: parsed.newTotalAmountCents ?? contract.total_amount_cents,
          note: parsed.note,
        },
      });
    }

    return { contractId: contract.id, status: nextStatus };
  }
}
