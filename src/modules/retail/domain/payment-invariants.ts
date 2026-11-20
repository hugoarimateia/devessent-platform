import { ForbiddenError, ValidationError } from "@/core/errors/app-error";
import type {
  RetailOrder,
  RetailPaymentConnectionSummary,
  RetailPaymentMethod,
  RetailPaymentPeriodBucket,
  RetailPaymentStats,
  RetailPaymentStatus,
} from "../types/retail.types";

export const RETAIL_PAYMENT_STATUS_LIST: readonly RetailPaymentStatus[] = [
  "not_started",
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
  "partially_refunded",
  "disputed",
] as const;

export interface PaymentStatusPresentation {
  label: string;
  shortLabel: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  description: string;
}

export const PAYMENT_STATUS_PRESENTATION: Record<
  RetailPaymentStatus,
  PaymentStatusPresentation
> = {
  not_started: {
    label: "Aguardando liberação de pagamento",
    shortLabel: "Não iniciado",
    tone: "neutral",
    description:
      "Nenhuma sessão de cobrança online foi iniciada para este pedido.",
  },
  pending: {
    label: "Aguardando pagamento do cliente",
    shortLabel: "Pendente",
    tone: "warning",
    description:
      "Sessão de checkout disponível. O estoque confirmado permanece reservado aguardando conclusão no provedor.",
  },
  processing: {
    label: "Em processamento no provedor",
    shortLabel: "Processando",
    tone: "info",
    description:
      "Transação submetida e em análise/compensação pelo provedor de pagamentos.",
  },
  paid: {
    label: "Pagamento confirmado",
    shortLabel: "Pago",
    tone: "success",
    description:
      "Valor confirmado diretamente pelo provedor na conta do estabelecimento. O ciclo operacional de entrega permanece independente.",
  },
  failed: {
    label: "Pagamento recusado",
    shortLabel: "Recusado",
    tone: "danger",
    description:
      "A tentativa foi recusada pelo provedor ou emissor. O comprador pode iniciar uma nova tentativa.",
  },
  expired: {
    label: "Sessão expirada",
    shortLabel: "Expirado",
    tone: "warning",
    description:
      "O prazo da sessão de checkout expirou sem confirmação de pagamento.",
  },
  cancelled: {
    label: "Cobrança cancelada",
    shortLabel: "Cancelado",
    tone: "neutral",
    description:
      "A cobrança pendente foi invalidada ou cancelada antes de qualquer pagamento.",
  },
  refunded: {
    label: "Reembolsado integralmente",
    shortLabel: "Reembolsado",
    tone: "info",
    description:
      "O valor pago foi devolvido integralmente ao comprador com confirmação do provedor.",
  },
  partially_refunded: {
    label: "Reembolsado parcialmente",
    shortLabel: "Reemb. parcial",
    tone: "warning",
    description:
      "Parte do valor pago foi devolvida ao comprador com confirmação do provedor.",
  },
  disputed: {
    label: "Em contestação (Chargeback / Mediação)",
    shortLabel: "Em disputa",
    tone: "danger",
    description:
      "Transação sob contestação ou mediação junto ao provedor de pagamentos.",
  },
};

export const PAYMENT_METHOD_LABELS: Record<RetailPaymentMethod, string> = {
  pix: "Pix",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  account_money: "Saldo Mercado Pago",
  boleto: "Boleto Bancário",
  hosted_checkout: "Checkout Pro (Hospedado)",
  other: "Outro Método",
};

export interface PaymentEligibilityEvaluation {
  eligible: boolean;
  reason: string | null;
}

export class PaymentInvariants {
  /**
   * Fail-Closed (§16): Bloqueia qualquer tentativa de habilitar modo 'live' ou credenciais reais na Fase 6D.
   */
  public static assertSandboxOnlyMode(
    environment: string | null | undefined,
    tokenOrKey?: string | null
  ): void {
    if (environment !== "sandbox") {
      throw new ForbiddenError(
        "FAIL-CLOSED: Pagamentos reais (live) estão desabilitados na Fase 6D. Apenas o ambiente 'sandbox' é permitido."
      );
    }

    if (tokenOrKey && /^(APP_USR_LIVE_|LIVE_|PROD_)/i.test(tokenOrKey.trim())) {
      throw new ForbiddenError(
        "FAIL-CLOSED: Credencial de produção detectada em ambiente Sandbox. Utilize apenas credenciais de teste/sandbox."
      );
    }
  }

  /**
   * Avalia se um pedido cumpre todos os pré-requisitos dos §§7 e 8 para pagamento online:
   * 1. Pedido confirmado operacionalmente ('confirmed', 'preparing', 'ready').
   * 2. Não estar pago, reembolsado ou em disputa.
   * 3. Se delivery_mode === 'delivery', o valor de entrega (shippingFeeCents) deve estar definido (não nulo).
   * 4. Total final positivo e consistente com subtotal + frete - desconto.
   * 5. Moeda suportada ('BRL').
   * 6. Estabelecimento com conta de pagamentos conectada em modo Sandbox.
   */
  public static evaluateOrderPaymentEligibility(
    order: Pick<
      RetailOrder,
      | "status"
      | "paymentStatus"
      | "deliveryMode"
      | "subtotalCents"
      | "shippingFeeCents"
      | "discountCents"
      | "totalCents"
      | "currency"
    >,
    connection: Pick<
      RetailPaymentConnectionSummary,
      "status" | "environment" | "sellerAccountId"
    > | null
  ): PaymentEligibilityEvaluation {
    if (order.status === "requested") {
      return {
        eligible: false,
        reason:
          "O pedido ainda aguarda confirmação de disponibilidade e reserva de estoque pela loja.",
      };
    }

    if (order.status === "cancelled") {
      return {
        eligible: false,
        reason: "Pedidos cancelados não podem receber pagamento.",
      };
    }

    if (order.status === "completed") {
      return {
        eligible: false,
        reason: "Este pedido já foi encerrado operacionalmente.",
      };
    }

    const pStatus = order.paymentStatus || "not_started";
    if (
      pStatus === "paid" ||
      pStatus === "partially_refunded" ||
      pStatus === "refunded" ||
      pStatus === "disputed"
    ) {
      return {
        eligible: false,
        reason: "Este pedido já possui pagamento processado.",
      };
    }

    if (
      order.deliveryMode === "delivery" &&
      (order.shippingFeeCents === null || order.shippingFeeCents === undefined)
    ) {
      return {
        eligible: false,
        reason:
          "O valor de entrega ainda está a combinar. O lojista precisa definir o frete antes de liberar o pagamento online.",
      };
    }

    const shipping = order.shippingFeeCents ?? 0;
    const discount = order.discountCents ?? 0;
    const expectedTotal = order.subtotalCents + shipping - discount;

    if (expectedTotal <= 0 || order.totalCents !== expectedTotal) {
      return {
        eligible: false,
        reason: "O valor total do pedido ainda não está consolidado para cobrança.",
      };
    }

    if (order.currency !== "BRL") {
      return {
        eligible: false,
        reason: `A moeda ${order.currency} não é suportada pelo gateway atual.`,
      };
    }

    if (
      !connection ||
      connection.status !== "connected" ||
      connection.environment !== "sandbox" ||
      !connection.sellerAccountId?.trim()
    ) {
      return {
        eligible: false,
        reason:
          "O estabelecimento ainda não possui conta de pagamentos conectada para checkout online.",
      };
    }

    return { eligible: true, reason: null };
  }

  /**
   * Proteção contra eventos fora de ordem (§10):
   * Um pagamento já confirmado/reembolsado nunca regride para pending, processing, failed, expired ou cancelled.
   */
  public static isOutOfOrderTransition(
    currentStatus: RetailPaymentStatus,
    incomingStatus: RetailPaymentStatus
  ): boolean {
    if (currentStatus === "refunded" && incomingStatus !== "refunded") {
      return true;
    }
    if (
      currentStatus === "paid" ||
      currentStatus === "partially_refunded" ||
      currentStatus === "refunded"
    ) {
      return (
        incomingStatus === "pending" ||
        incomingStatus === "processing" ||
        incomingStatus === "failed" ||
        incomingStatus === "expired" ||
        incomingStatus === "cancelled"
      );
    }
    return false;
  }

  /**
   * Constrói referência externa canônica vinculada a tenant, pedido e pagamento.
   */
  public static buildCanonicalExternalReference(params: {
    tenantId: string;
    orderId: string;
    orderNumber: string;
  }): string {
    return `devessent:t:${params.tenantId}:o:${params.orderId}:n:${params.orderNumber}`;
  }

  public static parseCanonicalExternalReference(ref: string | null | undefined): {
    tenantId: string;
    orderId: string;
    orderNumber: string;
  } | null {
    if (!ref) return null;
    const match = /^devessent:t:([0-9a-f-]{36}):o:([0-9a-f-]{36}):n:([A-Z0-9-]+)$/i.exec(
      ref.trim()
    );
    if (!match) return null;
    return {
      tenantId: match[1].toLowerCase(),
      orderId: match[2].toLowerCase(),
      orderNumber: match[3].toUpperCase(),
    };
  }

  public static minimizeCustomerName(fullName: string | null | undefined): string {
    if (!fullName) return "Cliente";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "Cliente";
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
    return `${first} ${lastInitial}.`;
  }

  public static maskEmail(email: string | null | undefined): string | null {
    if (!email || !email.includes("@")) return null;
    const [local, domain] = email.trim().split("@");
    if (!local || !domain) return null;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain.toLowerCase()}`;
  }

  public static assertValidAmountMatch(expectedCents: number, actualCents: number): void {
    if (!Number.isInteger(expectedCents) || !Number.isInteger(actualCents) || expectedCents <= 0) {
      throw new ValidationError("Valores financeiros inválidos para conciliação.");
    }
    if (expectedCents !== actualCents) {
      throw new ValidationError(
        `Divergência de valor detectada: esperado ${expectedCents} centavos, recebido ${actualCents} centavos.`
      );
    }
  }
}

export interface PaymentStatsInputItem {
  status: RetailPaymentStatus;
  amountCents: number;
  refundedAmountCents: number;
  divergenceAlert: string | null;
  approvedAt: string | null;
  createdAt: string;
}

/**
 * Consolida métricas financeiras estritamente a partir de pagamentos confirmados menos estornos.
 * Função pura livre de dependências de infraestrutura (utilizada por Supabase e XAMPP).
 */
export function computeStatsFromPayments(
  payments: PaymentStatsInputItem[]
): RetailPaymentStats {
  let grossConfirmedCents = 0;
  let refundedCents = 0;
  let pendingCents = 0;
  let rejectedOrExpiredCents = 0;
  let paidOrdersCount = 0;
  let pendingPaymentsCount = 0;
  let rejectedPaymentsCount = 0;
  let refundedPaymentsCount = 0;
  let divergenceAlertsCount = 0;

  const bucketMap = new Map<string, RetailPaymentPeriodBucket>();

  for (const p of payments) {
    if (p.divergenceAlert) divergenceAlertsCount++;

    // Somente pagamentos efetivamente confirmados pelo provedor integram valores recebidos
    if (p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded") {
      grossConfirmedCents += p.amountCents;
      refundedCents += p.refundedAmountCents;
      if (p.status === "paid" || p.status === "partially_refunded") {
        paidOrdersCount++;
      }
      if (p.refundedAmountCents > 0 || p.status === "refunded") {
        refundedPaymentsCount++;
      }

      const dayKey = (p.approvedAt || p.createdAt).slice(0, 10);
      const existing = bucketMap.get(dayKey) || {
        periodLabel: dayKey.split("-").reverse().slice(0, 2).join("/"),
        confirmedCents: 0,
        refundedCents: 0,
        netConfirmedCents: 0,
        paidCount: 0,
      };
      existing.confirmedCents += p.amountCents;
      existing.refundedCents += p.refundedAmountCents;
      existing.netConfirmedCents = Math.max(0, existing.confirmedCents - existing.refundedCents);
      if (p.status === "paid" || p.status === "partially_refunded") {
        existing.paidCount += 1;
      }
      bucketMap.set(dayKey, existing);
    } else if (p.status === "pending" || p.status === "processing") {
      pendingCents += p.amountCents;
      pendingPaymentsCount++;
    } else if (p.status === "failed" || p.status === "expired" || p.status === "cancelled") {
      rejectedOrExpiredCents += p.amountCents;
      rejectedPaymentsCount++;
    }
  }

  return {
    grossConfirmedCents,
    netReceivedCents: Math.max(0, grossConfirmedCents - refundedCents),
    pendingCents,
    rejectedOrExpiredCents,
    refundedCents,
    paidOrdersCount,
    pendingPaymentsCount,
    rejectedPaymentsCount,
    refundedPaymentsCount,
    divergenceAlertsCount,
    periodEvolution: Array.from(bucketMap.values()).slice(-7),
  };
}
