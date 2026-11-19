"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import { AuthService } from "@/core/auth/services/auth-service";
import { TenantService } from "@/core/tenants/services/tenant-service";
import { toPublicErrorMessage } from "@/core/errors/public-error";
import {
  RATE_LIMIT_POLICIES,
  RateLimitService,
} from "@/core/security/rate-limit-service";
import { RetailPaymentService } from "../services/retail-payment-service";
import { RetailStoreService } from "../services/retail-store-service";
import { readStoreOrderReceiptToken, hashOpaqueToken } from "../services/retail-cart-cookie";
import type {
  RetailOrder,
  RetailPaymentConnectionSummary,
  RetailPaymentMethod,
  RetailPaymentProviderName,
  RetailPaymentStatus,
  RetailPaymentWithDetails,
} from "../types/retail.types";

export interface PaymentActionResult<T = undefined> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

async function resolveClientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      "127.0.0.1"
    );
  } catch {
    return "127.0.0.1";
  }
}

async function resolveAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:3000";
  }
}

async function revalidatePaymentPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  orderId?: string,
  paymentId?: string
) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/atividades");
  revalidatePath("/dashboard/retail");
  revalidatePath("/dashboard/retail/pedidos");
  revalidatePath("/dashboard/retail/pagamentos");
  revalidatePath("/admin/sites");
  if (orderId) {
    revalidatePath(`/dashboard/retail/pedidos/${orderId}`);
  }
  if (paymentId) {
    revalidatePath(`/dashboard/retail/pagamentos/${paymentId}`);
  }
  const store = await RetailStoreService.getStore(supabase, tenantId);
  if (store?.slug) {
    revalidatePath(`/loja/${store.slug}`);
  }
}

/**
 * 1. Conectar conta de pagamento Sandbox do lojista (Exclusivo Platform Admin / DevEssent)
 */
export async function connectTenantPaymentAccountAction(input: {
  tenantId: string;
  provider?: RetailPaymentProviderName;
  sellerAccountId: string;
  sellerAccountLabel: string;
  accessToken: string;
  webhookSecret: string;
}): Promise<PaymentActionResult<RetailPaymentConnectionSummary>> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    if (!sessionUser.isPlatformAdmin) {
      return {
        success: false,
        error:
          "Apenas a equipe técnica da DevEssent (Platform Admin) pode configurar credenciais de pagamento.",
      };
    }

    const summary = await RetailPaymentService.connectSellerAccount({
      supabase,
      actorUserId: sessionUser.id,
      actorRole: "platform_admin",
      rawInput: {
        tenantId: input.tenantId,
        provider:
          input.provider ?? (isXamppTestMode() ? "xampp_sandbox" : "mercado_pago"),
        environment: "sandbox",
        sellerAccountId: input.sellerAccountId,
        sellerAccountLabel: input.sellerAccountLabel,
        accessToken: input.accessToken,
        webhookSecret: input.webhookSecret,
      },
    });

    await revalidatePaymentPaths(supabase, input.tenantId);

    return {
      success: true,
      message: "Conta de recebimento Sandbox conectada com sucesso ao estabelecimento.",
      data: summary,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível conectar a conta de pagamento."),
    };
  }
}

/**
 * 2. Desconectar conta de pagamento Sandbox do lojista (Exclusivo Platform Admin)
 */
export async function disconnectTenantPaymentAccountAction(
  tenantId: string
): Promise<PaymentActionResult> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    if (!sessionUser.isPlatformAdmin) {
      return {
        success: false,
        error:
          "Apenas a equipe técnica da DevEssent (Platform Admin) pode desconectar credenciais de pagamento.",
      };
    }

    await RetailPaymentService.disconnectSellerAccount({
      supabase,
      actorUserId: sessionUser.id,
      actorRole: "platform_admin",
      tenantId,
    });

    await revalidatePaymentPaths(supabase, tenantId);

    return {
      success: true,
      message: "Conta de recebimento Sandbox desconectada com segurança.",
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(
        err,
        "Não foi possível desconectar a conta de pagamento."
      ),
    };
  }
}

/**
 * 3. Definir frete determinístico de um pedido (para habilitar pagamento online em pedidos delivery)
 */
export async function setRetailOrderShippingFeeAction(
  tenantId: string,
  orderId: string,
  shippingFeeCents: number
): Promise<PaymentActionResult<RetailOrder>> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updatedOrder = await RetailPaymentService.setOrderShippingFee({
      supabase,
      context,
      actorName: sessionUser.fullName || sessionUser.email,
      rawInput: {
        orderId,
        shippingFeeCents,
      },
    });

    await revalidatePaymentPaths(supabase, context.tenantId, orderId);

    return {
      success: true,
      message: "Frete definido e total do pedido recalculado com sucesso.",
      data: updatedOrder,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível definir o frete do pedido."),
    };
  }
}

/**
 * 4. Gerar link público opaco de pagamento para enviar ao comprador
 */
export async function generateOrderPaymentShareLinkAction(
  tenantId: string,
  orderId: string
): Promise<
  PaymentActionResult<{
    shareToken: string;
    sharePath: string;
    fullShareUrl: string;
    expiresAt: string;
  }>
> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const res = await RetailPaymentService.generateOrderPaymentShareLink({
      supabase,
      context,
      orderId,
    });

    const baseUrl = await resolveAppBaseUrl();
    await revalidatePaymentPaths(supabase, context.tenantId, orderId);

    return {
      success: true,
      message: "Link seguro de pagamento gerado com validade de 72 horas.",
      data: {
        ...res,
        fullShareUrl: `${baseUrl}${res.sharePath}`,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível gerar o link de pagamento."),
    };
  }
}

/**
 * 5. Iniciar sessão de pagamento online via página de comprovante público
 */
export async function startPublicPaymentByReceiptAction(
  storeSlug: string,
  orderNumber: string,
  idempotencyKey: string
): Promise<PaymentActionResult<{ paymentId: string; checkoutUrl: string; expiresAt: string }>> {
  try {
    const ip = await resolveClientIp();
    const rateKey = `${ip}:${storeSlug}:${orderNumber}`;
    await RateLimitService.assertNotBlocked(
      RATE_LIMIT_POLICIES.retailPaymentSession,
      rateKey
    );
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.retailPaymentSession,
      rateKey
    );

    const publicToken = await readStoreOrderReceiptToken(storeSlug, orderNumber);
    if (!publicToken) {
      return {
        success: false,
        error:
          "Sessão do comprovante expirada. Solicite o link de pagamento atualizado diretamente à loja.",
      };
    }

    const appBaseUrl = await resolveAppBaseUrl();
    const session = await RetailPaymentService.initiatePaymentSessionByReceiptToken({
      storeSlug,
      orderNumber,
      publicToken,
      idempotencyKey,
      appBaseUrl,
    });

    revalidatePath(`/loja/${storeSlug}/pedido/${orderNumber}`);
    return {
      success: true,
      data: session,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível iniciar o checkout de pagamento."),
    };
  }
}

/**
 * 6. Iniciar sessão de pagamento online via link opaco (/loja/[slug]/pagamento/[shareToken])
 */
export async function startPublicPaymentByShareTokenAction(
  storeSlug: string,
  shareToken: string,
  idempotencyKey: string
): Promise<PaymentActionResult<{ paymentId: string; checkoutUrl: string; expiresAt: string }>> {
  try {
    const ip = await resolveClientIp();
    const rateKey = `${ip}:${storeSlug}:share`;
    await RateLimitService.assertNotBlocked(
      RATE_LIMIT_POLICIES.retailPaymentSession,
      rateKey
    );
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.retailPaymentSession,
      rateKey
    );

    const appBaseUrl = await resolveAppBaseUrl();
    const session = await RetailPaymentService.initiatePaymentSessionByShareToken({
      storeSlug,
      shareToken,
      idempotencyKey,
      appBaseUrl,
    });

    revalidatePath(`/loja/${storeSlug}/pagamento/${shareToken}`);
    return {
      success: true,
      data: session,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível iniciar o checkout de pagamento."),
    };
  }
}

/**
 * 7. Simular conclusão de pagamento no Checkout Sandbox (exclusivo ambiente Sandbox)
 */
export async function simulatePublicSandboxCheckoutOutcomeAction(params: {
  storeSlug: string;
  shareToken?: string;
  orderNumber?: string;
  outcome: "approved" | "pending" | "rejected" | "expired" | "cancelled";
  paymentMethod?: RetailPaymentMethod;
}): Promise<
  PaymentActionResult<{
    paymentId: string;
    orderId: string;
    paymentStatus: RetailPaymentStatus;
    externalPaymentId: string;
  }>
> {
  try {
    let tenantId: string | null = null;
    let orderId: string | null = null;

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { xamppQuery } = await import("@/infrastructure/xampp-test/db");
      if (params.shareToken) {
        const tokenHash = hashOpaqueToken(params.shareToken.trim());
        const rows = await xamppQuery<Array<RowDataPacket & { id: string; tenant_id: string }>>(
          `SELECT o.id, o.tenant_id
             FROM retail_orders o
             INNER JOIN retail_stores s ON s.id = o.store_id
            WHERE s.slug = ? AND o.payment_share_token_hash = ? LIMIT 1`,
          [params.storeSlug, tokenHash]
        );
        if (rows[0]) {
          tenantId = rows[0].tenant_id;
          orderId = rows[0].id;
        }
      } else if (params.orderNumber) {
        const receiptToken = await readStoreOrderReceiptToken(
          params.storeSlug,
          params.orderNumber
        );
        if (receiptToken) {
          const tokenHash = hashOpaqueToken(receiptToken);
          const rows = await xamppQuery<Array<RowDataPacket & { id: string; tenant_id: string }>>(
            `SELECT o.id, o.tenant_id
               FROM retail_orders o
               INNER JOIN retail_stores s ON s.id = o.store_id
              WHERE s.slug = ? AND o.order_number = ? AND o.public_token_hash = ? LIMIT 1`,
            [params.storeSlug, params.orderNumber.toUpperCase(), tokenHash]
          );
          if (rows[0]) {
            tenantId = rows[0].tenant_id;
            orderId = rows[0].id;
          }
        }
      }
    } else {
      const admin = createAdminClient();
      const { data: storeRow } = await admin
        .from("retail_stores")
        .select("id, tenant_id")
        .eq("slug", params.storeSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (storeRow) {
        if (params.shareToken) {
          const tokenHash = hashOpaqueToken(params.shareToken.trim());
          const { data: orderRow } = await admin
            .from("retail_orders")
            .select("id")
            .eq("store_id", storeRow.id)
            .eq("tenant_id", storeRow.tenant_id)
            .eq("payment_share_token_hash", tokenHash)
            .maybeSingle();
          if (orderRow) {
            tenantId = storeRow.tenant_id;
            orderId = orderRow.id;
          }
        } else if (params.orderNumber) {
          const receiptToken = await readStoreOrderReceiptToken(
            params.storeSlug,
            params.orderNumber
          );
          if (receiptToken) {
            const tokenHash = hashOpaqueToken(receiptToken);
            const { data: orderRow } = await admin
              .from("retail_orders")
              .select("id")
              .eq("store_id", storeRow.id)
              .eq("tenant_id", storeRow.tenant_id)
              .eq("order_number", params.orderNumber.trim().toUpperCase())
              .eq("public_token_hash", tokenHash)
              .maybeSingle();
            if (orderRow) {
              tenantId = storeRow.tenant_id;
              orderId = orderRow.id;
            }
          }
        }
      }
    }

    if (!tenantId || !orderId) {
      return {
        success: false,
        error: "Sessão de pagamento não localizada ou não autorizada.",
      };
    }

    const result = await RetailPaymentService.simulateSandboxProviderOutcome({
      tenantId,
      orderId,
      outcome: params.outcome,
      paymentMethod: params.paymentMethod ?? "pix",
    });

    if (params.shareToken) {
      revalidatePath(`/loja/${params.storeSlug}/pagamento/${params.shareToken}`);
    }
    if (params.orderNumber) {
      revalidatePath(`/loja/${params.storeSlug}/pedido/${params.orderNumber}`);
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/retail");
    revalidatePath("/dashboard/retail/pedidos");
    revalidatePath(`/dashboard/retail/pedidos/${orderId}`);
    revalidatePath("/dashboard/retail/pagamentos");
    revalidatePath(`/dashboard/retail/pagamentos/${result.paymentId}`);

    return {
      success: true,
      message: "Notificação de webhook Sandbox processada e reconciliada com sucesso.",
      data: {
        paymentId: result.paymentId,
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        externalPaymentId: result.externalPaymentId,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Falha ao simular retorno do provedor Sandbox."),
    };
  }
}

/**
 * 8. Reconciliar pagamento manualmente no painel administrativo
 */
export async function reconcileRetailPaymentAction(
  tenantId: string,
  paymentId: string,
  externalPaymentId?: string
): Promise<PaymentActionResult<RetailPaymentWithDetails>> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailPaymentService.reconcilePayment({
      supabase,
      context,
      paymentId,
      externalPaymentId,
    });

    await revalidatePaymentPaths(supabase, context.tenantId, updated.orderId, paymentId);

    return {
      success: true,
      message: "Status financeiro verificado junto ao provedor com sucesso.",
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível reconciliar o pagamento."),
    };
  }
}

/**
 * 9. Cancelar ou expirar sessão de pagamento pendente
 */
export async function cancelPendingRetailPaymentAction(
  tenantId: string,
  paymentId: string,
  mode: "expired" | "cancelled" = "cancelled"
): Promise<PaymentActionResult<RetailPaymentWithDetails>> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailPaymentService.expireOrCancelPendingPayment({
      supabase,
      context,
      paymentId,
      mode,
    });

    await revalidatePaymentPaths(supabase, context.tenantId, updated.orderId, paymentId);

    return {
      success: true,
      message:
        mode === "expired"
          ? "Sessão de pagamento marcada como expirada."
          : "Sessão de pagamento pendente cancelada.",
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(err, "Não foi possível cancelar a sessão de pagamento."),
    };
  }
}

/**
 * 10. Solicitar estorno confirmado ao provedor de pagamento
 */
export async function requestRetailPaymentRefundAction(
  tenantId: string,
  paymentId: string,
  refundAmountCents: number,
  reason: string,
  idempotencyKey: string
): Promise<PaymentActionResult<RetailPaymentWithDetails>> {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);
  if (!sessionUser) redirect("/login");

  try {
    const context = await TenantService.resolveTenantContext(
      supabase,
      sessionUser.id,
      tenantId
    );

    const updated = await RetailPaymentService.requestConfirmedRefund({
      supabase,
      context,
      actorName: sessionUser.fullName || sessionUser.email,
      rawInput: {
        paymentId,
        refundAmountCents,
        reason,
      },
      idempotencyKey,
    });

    await revalidatePaymentPaths(supabase, context.tenantId, updated.orderId, paymentId);

    return {
      success: true,
      message:
        "Estorno confirmado pelo provedor e registrado no histórico financeiro.",
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: toPublicErrorMessage(
        err,
        "Não foi possível processar o estorno junto ao provedor."
      ),
    };
  }
}
