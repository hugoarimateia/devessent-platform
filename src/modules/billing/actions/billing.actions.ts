"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors/app-error";
import { resolveSessionUserCached, resolveWorkspaceSession } from "@/lib/workspace/workspace-context";
import { BillingPlanService } from "../services/billing-plan-service";
import { BillingSubscriptionService } from "../services/billing-subscription-service";
import { ImplementationContractService } from "../services/implementation-contract-service";
import type {
  AuthorizeSubscriptionPaymentInput,
  CancelBillingSubscriptionInput,
  ConfirmImplementationInstallmentInput,
  CreateBillingPlanInput,
  CreateBillingSubscriptionInput,
  CreateImplementationContractInput,
  SimulateSandboxChargeInput,
  UpdateBillingPlanInput,
  UpdateImplementationContractActionInput,
  UpdateSubscriptionContractInput,
  UpdateSubscriptionPaymentMethodInput,
} from "../schemas/billing.schema";
import type { ManualPaymentMethod } from "../types/billing.types";

export interface BillingActionResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

function handleActionError(err: unknown, fallback: string): BillingActionResult<never> {
  if (err instanceof AppError) {
    return { success: false, error: err.message };
  }
  if (err instanceof Error && err.name === "ZodError") {
    return { success: false, error: "Dados inválidos: verifique os campos obrigatórios." };
  }
  return {
    success: false,
    error: err instanceof Error ? err.message : fallback,
  };
}

async function requirePlatformAdminActor() {
  const sessionUser = await resolveSessionUserCached();
  if (!sessionUser) {
    throw new AppError("Sessão expirada. Faça login novamente.", 401, "UNAUTHORIZED");
  }
  if (!sessionUser.isPlatformAdmin) {
    throw new AppError(
      "Acesso restrito exclusivamente aos administradores globais da DevEssent.",
      403,
      "FORBIDDEN"
    );
  }
  const supabase = await createClient();
  return { sessionUser, supabase };
}

export async function createBillingPlanAction(
  input: CreateBillingPlanInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const plan = await BillingPlanService.createPlan({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    return { success: true, data: plan, message: `Plano "${plan.name}" criado com sucesso.` };
  } catch (err) {
    return handleActionError(err, "Erro ao criar plano comercial.");
  }
}

export async function updateBillingPlanAction(
  input: UpdateBillingPlanInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const plan = await BillingPlanService.updatePlan({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    return {
      success: true,
      data: plan,
      message: `Plano "${plan.name}" atualizado para v${plan.version} (assinaturas existentes preservadas).`,
    };
  } catch (err) {
    return handleActionError(err, "Erro ao atualizar plano comercial.");
  }
}

export async function createBillingSubscriptionAction(
  input: CreateBillingSubscriptionInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const sub = await BillingSubscriptionService.createSubscription({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: sub,
      message: "Assinatura vinculada. Aguardando autorização financeira do empresário.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao vincular empresa ao plano.");
  }
}

export async function confirmSubscriptionActivationAction(
  subscriptionId: string,
  note?: string
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const sub = await BillingSubscriptionService.confirmActivationMilestone({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      subscriptionId,
      note,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: sub,
      message: "Marco contratual de ativação registrado com sucesso.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao confirmar ativação da assinatura.");
  }
}

export async function updateSubscriptionContractAction(
  input: UpdateSubscriptionContractInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const sub = await BillingSubscriptionService.updateSubscriptionContract({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return { success: true, data: sub, message: "Condições contratuais atualizadas com auditoria." };
  } catch (err) {
    return handleActionError(err, "Erro ao atualizar condições da assinatura.");
  }
}

export async function cancelBillingSubscriptionAction(
  input: CancelBillingSubscriptionInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const sub = await BillingSubscriptionService.cancelSubscription({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: sub,
      message:
        input.mode === "immediate"
          ? "Assinatura cancelada imediatamente."
          : "Cancelamento agendado para o fim do ciclo atual.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao cancelar assinatura.");
  }
}

export async function simulateSandboxChargeAction(
  input: SimulateSandboxChargeInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser } = await requirePlatformAdminActor();
    const res = await BillingSubscriptionService.simulateSandboxRecurringCharge({
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: res,
      message: `Webhook Sandbox processado (${res.outcome} · fatura: ${res.invoiceStatus ?? "—"} · assinatura: ${res.subscriptionStatus ?? "—"}).`,
    };
  } catch (err) {
    return handleActionError(err, "Erro ao simular ciclo recorrente Sandbox.");
  }
}

export async function runOfficialProviderDiagnosticAction(): Promise<BillingActionResult> {
  try {
    await requirePlatformAdminActor();
    const res = await BillingSubscriptionService.runOfficialProviderDiagnostic({
      actorRole: "platform_admin",
    });
    return {
      success: true,
      data: res,
      message: res.diagnosticMessage,
    };
  } catch (err) {
    return handleActionError(err, "Falha no diagnóstico autoritativo do Mercado Pago Sandbox.");
  }
}

export async function syncSubscriptionFromProviderAction(
  subscriptionId: string
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const res = await BillingSubscriptionService.syncSubscriptionFromProvider({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      subscriptionId,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: res,
      message: `Sincronização Mercado Pago concluída (status: ${res.newStatus} · faturas conciliadas: ${res.authorizedPaymentsSynced}).`,
    };
  } catch (err) {
    return handleActionError(err, "Erro ao sincronizar assinatura com o Mercado Pago Sandbox.");
  }
}

export async function createImplementationContractAction(
  input: CreateImplementationContractInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const contract = await ImplementationContractService.createContract({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: contract,
      message: `Contrato ${contract.contractCode} criado (${contract.entryPercent}%/${contract.balancePercent}%).`,
    };
  } catch (err) {
    return handleActionError(err, "Erro ao criar contrato de implantação.");
  }
}

export async function attachInstallmentReceiptAction(
  formData: FormData
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const installmentId = String(formData.get("installmentId") || "").trim();
    const methodRaw = String(formData.get("reportedPaymentMethod") || "").trim();
    const file = formData.get("file");

    if (!installmentId) {
      return { success: false, error: "Identificador da parcela obrigatório." };
    }
    if (!(file instanceof File)) {
      return { success: false, error: "Selecione um arquivo PDF, PNG, JPEG ou WebP." };
    }

    const arrayBuf = await file.arrayBuffer();
    const updated = await ImplementationContractService.attachInstallmentReceipt({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      installmentId,
      fileBuffer: Buffer.from(arrayBuf),
      fileName: file.name,
      reportedPaymentMethod: (methodRaw || undefined) as ManualPaymentMethod | undefined,
    });

    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: updated,
      message: "Comprovante anexado com segurança. Confirme o recebimento após conferência financeira.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao anexar comprovante da parcela.");
  }
}

export async function confirmImplementationInstallmentAction(
  input: ConfirmImplementationInstallmentInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const res = await ImplementationContractService.confirmInstallmentReceived({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: res,
      message: "Recebimento manual confirmado com registro em auditoria.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao confirmar recebimento manual.");
  }
}

export async function updateImplementationContractAction(
  input: UpdateImplementationContractActionInput
): Promise<BillingActionResult> {
  try {
    const { sessionUser, supabase } = await requirePlatformAdminActor();
    const res = await ImplementationContractService.applyContractLifecycleAction({
      supabase,
      actorRole: "platform_admin",
      actorUserId: sessionUser.id,
      input,
    });
    revalidatePath("/admin/comercial");
    revalidatePath("/dashboard/assinatura");
    return {
      success: true,
      data: res,
      message: "Status do contrato de implantação atualizado.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao atualizar contrato de implantação.");
  }
}

/**
 * Ações restritas do Proprietário da Empresa (/dashboard/assinatura):
 * Apenas autorização de cobrança recorrente e atualização do método de pagamento do próprio tenant.
 */
export async function authorizeOwnSubscriptionAction(
  input: AuthorizeSubscriptionPaymentInput
): Promise<BillingActionResult> {
  try {
    const workspace = await resolveWorkspaceSession();
    if (!workspace.sessionUser || !workspace.activeContext) {
      return { success: false, error: "Sessão inválida. Faça login novamente." };
    }
    const sub = await BillingSubscriptionService.authorizeSubscriptionPayment({
      actorRole: workspace.activeContext.role,
      actorUserId: workspace.sessionUser.id,
      actorTenantId: workspace.activeContext.tenantId,
      input,
    });
    revalidatePath("/dashboard/assinatura");
    revalidatePath("/admin/comercial");
    return {
      success: true,
      data: sub,
      message: "Autorização de recorrência registrada em modo Sandbox com sucesso.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao registrar autorização de pagamento.");
  }
}

export async function updateOwnPaymentMethodAction(
  input: UpdateSubscriptionPaymentMethodInput
): Promise<BillingActionResult> {
  try {
    const workspace = await resolveWorkspaceSession();
    if (!workspace.sessionUser || !workspace.activeContext) {
      return { success: false, error: "Sessão inválida. Faça login novamente." };
    }
    const sub = await BillingSubscriptionService.updatePaymentMethod({
      actorRole: workspace.activeContext.role,
      actorUserId: workspace.sessionUser.id,
      actorTenantId: workspace.activeContext.tenantId,
      input,
    });
    revalidatePath("/dashboard/assinatura");
    revalidatePath("/admin/comercial");
    return {
      success: true,
      data: sub,
      message: "Forma de pagamento atualizada com segurança.",
    };
  } catch (err) {
    return handleActionError(err, "Erro ao atualizar método de pagamento.");
  }
}
