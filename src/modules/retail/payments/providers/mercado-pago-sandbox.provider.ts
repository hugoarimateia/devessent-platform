import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ForbiddenError, ValidationError } from "@/core/errors/app-error";
import { PAYMENT_METHOD_LABELS, PaymentInvariants } from "../../domain/payment-invariants";
import type { RetailPaymentMethod, RetailPaymentStatus } from "../../types/retail.types";
import type {
  AuthoritativeTransactionRecord,
  ConfirmedRefundRecord,
  CreatePaymentSessionInput,
  CreatedPaymentSession,
  RequestRefundInput,
  RetailPaymentProvider,
  ValidatedWebhookNotification,
  ValidateWebhookNotificationInput,
} from "../payment-provider.interface";

const MP_API_BASE_URL = "https://api.mercadopago.com";

/**
 * Registro em memória para sessões/transações determinísticas quando o estabelecimento
 * opera com credencial sandbox sintética (TEST-DEVESSENT-SANDBOX-*) sem movimentar dinheiro real.
 */
interface SimulatedMpTransaction {
  externalPaymentId: string;
  externalPreferenceId: string;
  externalReference: string;
  sellerAccountId: string;
  status: RetailPaymentStatus;
  amountCents: number;
  refundedAmountCents: number;
  currency: string;
  paymentMethod: RetailPaymentMethod;
  approvedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
}

const globalForMpSim = globalThis as unknown as {
  __devessentSimulatedMpStore?: Map<string, SimulatedMpTransaction>;
};

const simulatedMpStore =
  globalForMpSim.__devessentSimulatedMpStore ??
  (globalForMpSim.__devessentSimulatedMpStore = new Map<
    string,
    SimulatedMpTransaction
  >());

export function isSimulatedMercadoPagoToken(token: string): boolean {
  const normalized = token.trim();
  return (
    normalized.startsWith("TEST-DEVESSENT-SANDBOX-") ||
    normalized.startsWith("SANDBOX-DEMO-TOKEN-")
  );
}

export function mapMercadoPagoStatus(
  mpStatus: string | null | undefined,
  refundedAmountCents = 0,
  totalAmountCents = 0
): RetailPaymentStatus {
  const normalized = (mpStatus || "").toLowerCase().trim();
  if (normalized === "refunded") {
    return refundedAmountCents > 0 && refundedAmountCents < totalAmountCents
      ? "partially_refunded"
      : "refunded";
  }
  if (normalized === "approved") {
    if (refundedAmountCents > 0 && refundedAmountCents >= totalAmountCents) return "refunded";
    if (refundedAmountCents > 0) return "partially_refunded";
    return "paid";
  }
  if (normalized === "in_process" || normalized === "authorized") {
    return "processing";
  }
  if (normalized === "in_mediation" || normalized === "charged_back") {
    return "disputed";
  }
  if (normalized === "rejected") {
    return "failed";
  }
  if (normalized === "cancelled") {
    return "cancelled";
  }
  if (normalized === "expired") {
    return "expired";
  }
  return "pending";
}

export function mapMercadoPagoMethod(
  paymentTypeId?: string | null,
  paymentMethodId?: string | null
): RetailPaymentMethod {
  const type = (paymentTypeId || "").toLowerCase();
  const method = (paymentMethodId || "").toLowerCase();
  if (type === "bank_transfer" || method === "pix") return "pix";
  if (type === "credit_card") return "credit_card";
  if (type === "debit_card") return "debit_card";
  if (type === "account_money") return "account_money";
  if (type === "ticket" || method.includes("bol")) return "boleto";
  return "hosted_checkout";
}

/**
 * Calcula assinatura HMAC-SHA256 no formato oficial do Mercado Pago Webhooks:
 * Manifest: `id:${dataId};request-id:${xRequestId};ts:${ts};`
 */
export function buildMercadoPagoWebhookSignature(params: {
  dataId: string;
  xRequestId: string;
  timestampSeconds: number;
  webhookSecret: string;
}): string {
  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${params.timestampSeconds};`;
  const v1 = createHmac("sha256", params.webhookSecret).update(manifest).digest("hex");
  return `ts=${params.timestampSeconds},v1=${v1}`;
}

export class MercadoPagoSandboxProvider implements RetailPaymentProvider {
  public readonly providerName = "mercado_pago" as const;
  public readonly environment = "sandbox" as const;

  /**
   * Registra/atualiza transação simulada determinística no modo Sandbox de homologação.
   */
  public static seedSimulatedTransaction(tx: SimulatedMpTransaction): void {
    simulatedMpStore.set(tx.externalPaymentId, { ...tx });
  }

  public static getSimulatedTransaction(
    externalPaymentId: string
  ): SimulatedMpTransaction | undefined {
    return simulatedMpStore.get(externalPaymentId);
  }

  public async createPaymentSession(
    input: CreatePaymentSessionInput
  ): Promise<CreatedPaymentSession> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox", input.sellerAccessToken);

    if (input.amountCents <= 0) {
      throw new ValidationError("Valor do pedido inválido para criação de preferência.");
    }

    // Modo Sandbox Determinístico de Homologação (quando token é TEST-DEVESSENT-SANDBOX-*)
    if (isSimulatedMercadoPagoToken(input.sellerAccessToken)) {
      const prefId = `MP-PREF-SBX-${randomUUID().slice(0, 12).toUpperCase()}`;
      const separator = input.returnUrl.includes("?") ? "&" : "?";
      const checkoutUrl = `${input.returnUrl}${separator}sandbox_checkout=1&pref_id=${encodeURIComponent(prefId)}`;

      return {
        provider: "mercado_pago",
        environment: "sandbox",
        externalPreferenceId: prefId,
        externalReference: input.externalReference,
        checkoutUrl,
        expiresAt: input.expiresAt,
        rawMetadata: {
          mode: "deterministic_sandbox",
          sellerAccountId: input.sellerAccountId,
          orderNumber: input.orderNumber,
        },
      };
    }

    // Chamada HTTP real à API de Preferências do Mercado Pago Checkout Pro
    const mpItems = input.items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      currency_id: item.currency,
      unit_price: Number((item.unitPriceCents / 100).toFixed(2)),
    }));

    if (input.shippingFeeCents > 0) {
      mpItems.push({
        id: "shipping_fee",
        title: "Frete / Entrega",
        quantity: 1,
        currency_id: input.currency,
        unit_price: Number((input.shippingFeeCents / 100).toFixed(2)),
      });
    }

    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      items: mpItems,
      payer: {
        name: input.payerName,
        ...(input.payerEmail ? { email: input.payerEmail } : {}),
      },
      external_reference: input.externalReference,
      back_urls: {
        success: input.returnUrl,
        pending: input.returnUrl,
        failure: input.returnUrl,
      },
      auto_return: "approved",
      expires: true,
      expiration_date_from: nowIso,
      expiration_date_to: input.expiresAt,
      statement_descriptor: input.storeName.slice(0, 13).toUpperCase(),
      ...(input.webhookUrl && input.webhookUrl.startsWith("https://")
        ? { notification_url: input.webhookUrl }
        : {}),
    };

    const res = await fetch(`${MP_API_BASE_URL}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.sellerAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(
        `Mercado Pago Preferences API retornou HTTP ${res.status} ao criar sessão Checkout Pro.`
      );
    }

    const data = (await res.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
      collector_id?: number | string;
    };

    if (
      data.collector_id &&
      String(data.collector_id) !== String(input.sellerAccountId)
    ) {
      throw new ForbiddenError(
        "O collector_id retornado pelo Mercado Pago diverge da conta recebedora configurada para o estabelecimento."
      );
    }

    const checkoutUrl = data.sandbox_init_point || data.init_point;
    if (!data.id || !checkoutUrl) {
      throw new Error("Resposta incompleta do Mercado Pago ao criar preferência de checkout.");
    }

    return {
      provider: "mercado_pago",
      environment: "sandbox",
      externalPreferenceId: String(data.id),
      externalReference: input.externalReference,
      checkoutUrl,
      expiresAt: input.expiresAt,
      rawMetadata: {
        preferenceId: String(data.id),
        collectorId: data.collector_id ? String(data.collector_id) : input.sellerAccountId,
      },
    };
  }

  public async getTransaction(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox", params.sellerAccessToken);

    if (isSimulatedMercadoPagoToken(params.sellerAccessToken)) {
      const sim = simulatedMpStore.get(params.externalPaymentId);
      if (!sim) {
        throw new ValidationError(
          `Transação sandbox '${params.externalPaymentId}' não encontrada no provedor.`
        );
      }

      return {
        provider: "mercado_pago",
        externalPaymentId: sim.externalPaymentId,
        externalPreferenceId: sim.externalPreferenceId,
        externalReference: sim.externalReference,
        sellerAccountId: sim.sellerAccountId,
        status: sim.status,
        amountCents: sim.amountCents,
        refundedAmountCents: sim.refundedAmountCents,
        currency: sim.currency,
        paymentMethod: sim.paymentMethod,
        paymentMethodLabel: PAYMENT_METHOD_LABELS[sim.paymentMethod] || "Checkout Pro",
        approvedAt: sim.approvedAt,
        failureCode: sim.failureCode,
        failureReason: sim.failureReason,
        rawSummary: {
          simulated: true,
          externalPaymentId: sim.externalPaymentId,
          collectorId: sim.sellerAccountId,
          status: sim.status,
        },
      };
    }

    const res = await fetch(
      `${MP_API_BASE_URL}/v1/payments/${encodeURIComponent(params.externalPaymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.sellerAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        `Falha ao consultar transação ${params.externalPaymentId} no Mercado Pago (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as {
      id: number | string;
      status: string;
      status_detail?: string;
      transaction_amount: number;
      transaction_amount_refunded?: number;
      currency_id: string;
      external_reference?: string;
      collector_id?: number | string;
      order?: { id?: number | string };
      payment_type_id?: string;
      payment_method_id?: string;
      date_approved?: string | null;
      live_mode?: boolean;
    };

    if (data.live_mode === true) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Transação em modo produção (live_mode=true) rejeitada pelo ambiente Sandbox."
      );
    }

    const amountCents = Math.round(Number(data.transaction_amount || 0) * 100);
    const refundedCents = Math.round(Number(data.transaction_amount_refunded || 0) * 100);
    const method = mapMercadoPagoMethod(data.payment_type_id, data.payment_method_id);
    const status = mapMercadoPagoStatus(data.status, refundedCents, amountCents);

    return {
      provider: "mercado_pago",
      externalPaymentId: String(data.id),
      externalPreferenceId: data.order?.id ? String(data.order.id) : null,
      externalReference: String(data.external_reference || ""),
      sellerAccountId: data.collector_id ? String(data.collector_id) : "",
      status,
      amountCents,
      refundedAmountCents: refundedCents,
      currency: String(data.currency_id || ""),
      paymentMethod: method,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[method] || "Checkout Pro",
      approvedAt: data.date_approved || null,
      failureCode: status === "failed" ? data.status_detail || "rejected" : null,
      failureReason:
        status === "failed" ? `Recusado pelo provedor (${data.status_detail || "rejected"})` : null,
      rawSummary: {
        mpId: String(data.id),
        mpStatus: data.status,
        mpStatusDetail: data.status_detail || null,
        collectorId: data.collector_id ? String(data.collector_id) : null,
      },
    };
  }

  public validateWebhookNotification(
    input: ValidateWebhookNotificationInput
  ): ValidatedWebhookNotification {
    const xSignature =
      input.headers["x-signature"] || input.headers["X-Signature"] || "";
    const xRequestId =
      input.headers["x-request-id"] || input.headers["X-Request-Id"] || "";

    if (!xSignature || !xRequestId) {
      throw new ForbiddenError(
        "Cabeçalhos obrigatórios de assinatura de webhook (x-signature / x-request-id) ausentes."
      );
    }

    let bodyObj: {
      id?: string | number;
      type?: string;
      action?: string;
      live_mode?: boolean;
      data?: { id?: string | number };
    } = {};

    try {
      bodyObj = JSON.parse(input.rawBody || "{}") as typeof bodyObj;
    } catch {
      throw new ValidationError("Payload JSON do webhook inválido.");
    }

    if (bodyObj.live_mode === true) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Notificação de webhook live_mode=true rejeitada no ambiente Sandbox."
      );
    }

    const dataIdRaw =
      input.query["data.id"] ||
      (bodyObj.data?.id !== undefined ? String(bodyObj.data.id) : "");

    if (!dataIdRaw || !/^[A-Za-z0-9_-]+$/.test(dataIdRaw)) {
      throw new ValidationError("Identificador data.id ausente ou inválido na notificação.");
    }

    // Parse x-signature: ts=...,v1=...
    let tsValue: string | null = null;
    let v1Value: string | null = null;
    for (const part of xSignature.split(",")) {
      const [k, v] = part.trim().split("=");
      if (k === "ts" && v) tsValue = v.trim();
      if (k === "v1" && v) v1Value = v.trim();
    }

    if (!tsValue || !v1Value || !/^\d+$/.test(tsValue) || !/^[0-9a-f]{64}$/i.test(v1Value)) {
      throw new ForbiddenError("Formato do cabeçalho x-signature inválido.");
    }

    const tsSeconds = Number(tsValue);
    const nowSeconds = input.nowTimestampSeconds ?? Math.floor(Date.now() / 1000);
    const maxSkew = input.maxSkewSeconds ?? 300;

    if (Math.abs(nowSeconds - tsSeconds) > maxSkew) {
      throw new ForbiddenError(
        "Notificação de webhook fora da janela temporal permitida (proteção anti-replay)."
      );
    }

    const manifest = `id:${dataIdRaw.toLowerCase()};request-id:${xRequestId};ts:${tsSeconds};`;
    const expectedHmac = createHmac("sha256", input.webhookSecret)
      .update(manifest)
      .digest("hex");

    const receivedBuf = Buffer.from(v1Value.toLowerCase(), "utf-8");
    const expectedBuf = Buffer.from(expectedHmac.toLowerCase(), "utf-8");

    if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
      throw new ForbiddenError("Assinatura criptográfica HMAC-SHA256 do webhook inválida.");
    }

    const action = String(bodyObj.action || "payment.updated");
    const notifId = bodyObj.id !== undefined ? String(bodyObj.id) : xRequestId;
    const externalEventId = `mp:${notifId}:${action}:${dataIdRaw}`;

    return {
      verified: true,
      externalEventId,
      eventType: `webhook.${action}`,
      externalPaymentId: dataIdRaw,
      action,
      timestampSeconds: tsSeconds,
    };
  }

  public async cancelPayment(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
  }): Promise<{ cancelled: boolean; status: RetailPaymentStatus }> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox", params.sellerAccessToken);

    if (isSimulatedMercadoPagoToken(params.sellerAccessToken)) {
      const sim = simulatedMpStore.get(params.externalPaymentId);
      if (sim && (sim.status === "pending" || sim.status === "processing")) {
        sim.status = "cancelled";
        simulatedMpStore.set(params.externalPaymentId, sim);
      }
      return { cancelled: true, status: "cancelled" };
    }

    const res = await fetch(
      `${MP_API_BASE_URL}/v1/payments/${encodeURIComponent(params.externalPaymentId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${params.sellerAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      }
    );

    if (!res.ok) {
      throw new Error(`Não foi possível cancelar pagamento no Mercado Pago (HTTP ${res.status}).`);
    }

    return { cancelled: true, status: "cancelled" };
  }

  public async requestRefund(input: RequestRefundInput): Promise<ConfirmedRefundRecord> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox", input.sellerAccessToken);

    if (input.refundAmountCents <= 0 || input.refundAmountCents > input.totalPaymentAmountCents) {
      throw new ValidationError("Valor solicitado para reembolso é inválido.");
    }

    if (isSimulatedMercadoPagoToken(input.sellerAccessToken)) {
      const sim = simulatedMpStore.get(input.externalPaymentId);
      if (sim) {
        if (sim.status !== "paid" && sim.status !== "partially_refunded") {
          throw new ValidationError(
            "O provedor recusou o reembolso: transação não consta como paga no gateway."
          );
        }
        if (sim.sellerAccountId !== input.sellerAccountId) {
          throw new ForbiddenError("Conta recebedora diverge do titular da transação.");
        }

        sim.refundedAmountCents += input.refundAmountCents;
        sim.status =
          sim.refundedAmountCents >= sim.amountCents ? "refunded" : "partially_refunded";
        simulatedMpStore.set(input.externalPaymentId, sim);
      }

      const idemHash = createHash("sha256")
        .update(input.idempotencyKey)
        .digest("hex")
        .slice(0, 14)
        .toUpperCase();
      const refundId = `MP-REF-SBX-${idemHash}`;
      return {
        externalRefundId: refundId,
        externalPaymentId: input.externalPaymentId,
        refundedAmountCents: input.refundAmountCents,
        status: "approved",
        confirmedAt: new Date().toISOString(),
        rawSummary: {
          simulated: true,
          refundId,
          reason: input.reason,
        },
      };
    }

    const isFullRefund = input.refundAmountCents === input.totalPaymentAmountCents;
    const bodyPayload = isFullRefund
      ? {}
      : { amount: Number((input.refundAmountCents / 100).toFixed(2)) };

    const res = await fetch(
      `${MP_API_BASE_URL}/v1/payments/${encodeURIComponent(input.externalPaymentId)}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.sellerAccessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(bodyPayload),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Mercado Pago Refunds API recusou o estorno (HTTP ${res.status}).`
      );
    }

    const data = (await res.json()) as {
      id: number | string;
      payment_id: number | string;
      amount: number;
      status: string;
      date_created?: string;
    };

    if (data.status && data.status !== "approved") {
      throw new ValidationError(
        `O reembolso não foi confirmado imediatamente pelo provedor (status=${data.status}).`
      );
    }

    return {
      externalRefundId: String(data.id),
      externalPaymentId: String(data.payment_id || input.externalPaymentId),
      refundedAmountCents: Math.round(Number(data.amount || input.refundAmountCents / 100) * 100),
      status: "approved",
      confirmedAt: data.date_created || new Date().toISOString(),
      rawSummary: {
        mpRefundId: String(data.id),
        mpStatus: data.status || "approved",
      },
    };
  }

  public async reconcilePayment(params: {
    externalPaymentId?: string | null;
    externalReference: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord | null> {
    if (params.externalPaymentId) {
      return this.getTransaction({
        externalPaymentId: params.externalPaymentId,
        sellerAccessToken: params.sellerAccessToken,
        expectedSellerAccountId: params.expectedSellerAccountId,
      });
    }

    if (isSimulatedMercadoPagoToken(params.sellerAccessToken)) {
      for (const tx of simulatedMpStore.values()) {
        if (tx.externalReference === params.externalReference) {
          return this.getTransaction({
            externalPaymentId: tx.externalPaymentId,
            sellerAccessToken: params.sellerAccessToken,
            expectedSellerAccountId: params.expectedSellerAccountId,
          });
        }
      }
      return null;
    }

    const url = new URL(`${MP_API_BASE_URL}/v1/payments/search`);
    url.searchParams.set("external_reference", params.externalReference);
    url.searchParams.set("sort", "date_created");
    url.searchParams.set("criteria", "desc");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.sellerAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ id?: number | string }> };
    const firstId = data.results?.[0]?.id;
    if (!firstId) return null;

    return this.getTransaction({
      externalPaymentId: String(firstId),
      sellerAccessToken: params.sellerAccessToken,
      expectedSellerAccountId: params.expectedSellerAccountId,
    });
  }
}
