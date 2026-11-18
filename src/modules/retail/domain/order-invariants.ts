import { ValidationError } from "@/core/errors/app-error";
import type { RetailOrderStatus } from "../types/retail.types";

export const RETAIL_ORDER_STATUS_LIST: readonly RetailOrderStatus[] = [
  "requested",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export const ORDER_STATUS_TRANSITIONS: Record<RetailOrderStatus, readonly RetailOrderStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["preparing", "ready", "completed", "cancelled"],
  preparing: ["ready", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface OrderStatusPresentation {
  label: string;
  shortLabel: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  description: string;
}

export const ORDER_STATUS_PRESENTATION: Record<RetailOrderStatus, OrderStatusPresentation> = {
  requested: {
    label: "Aguardando confirmação",
    shortLabel: "Solicitado",
    tone: "warning",
    description: "Pedido registrado na loja aguardando validação de disponibilidade e confirmação.",
  },
  confirmed: {
    label: "Confirmado",
    shortLabel: "Confirmado",
    tone: "info",
    description: "Disponibilidade confirmada e estoque reservado/baixado pela equipe da loja.",
  },
  preparing: {
    label: "Em separação / preparo",
    shortLabel: "Em preparo",
    tone: "info",
    description: "Itens em conferência e preparação para entrega ou retirada.",
  },
  ready: {
    label: "Pronto para retirada / envio",
    shortLabel: "Pronto",
    tone: "success",
    description: "Pedido separado e pronto para ser entregue ao cliente.",
  },
  completed: {
    label: "Concluído",
    shortLabel: "Concluído",
    tone: "success",
    description: "Pedido entregue ou retirado e encerrado operacionalmente.",
  },
  cancelled: {
    label: "Cancelado",
    shortLabel: "Cancelado",
    tone: "danger",
    description: "Pedido cancelado. Caso o estoque tenha sido baixado na confirmação, o estorno ocorre automaticamente.",
  },
};

export class OrderInvariants {
  /**
   * Valida se uma transição entre estados de pedido é permitida pela máquina de estados comercial.
   */
  public static canTransition(from: RetailOrderStatus, to: RetailOrderStatus): boolean {
    if (from === to) return false;
    return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  public static assertValidTransition(from: RetailOrderStatus, to: RetailOrderStatus): void {
    if (!this.canTransition(from, to)) {
      const fromLabel = ORDER_STATUS_PRESENTATION[from]?.label || from;
      const toLabel = ORDER_STATUS_PRESENTATION[to]?.label || to;
      throw new ValidationError(
        `Transição de status inválida: não é possível alterar um pedido de "${fromLabel}" para "${toLabel}".`
      );
    }
  }

  /**
   * Calcula total de linha e subtotal estritamente em centavos inteiros positivos.
   */
  public static computeLineTotalCents(unitPriceCents: number, quantity: number): number {
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new ValidationError("Preço unitário inválido para cálculo do pedido.");
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
      throw new ValidationError("Quantidade inválida no item do pedido.");
    }
    return unitPriceCents * quantity;
  }

  public static computeSubtotalCents(
    items: ReadonlyArray<{ unitPriceCents: number; quantity: number }>
  ): number {
    return items.reduce((acc, item) => acc + this.computeLineTotalCents(item.unitPriceCents, item.quantity), 0);
  }

  /**
   * Normaliza e valida número de telefone para exibição/uso comercial.
   */
  public static normalizePhoneDigits(rawPhone: string | null | undefined): string {
    if (!rawPhone) return "";
    return rawPhone.replace(/\D/g, "");
  }

  /**
   * Constrói link opcional de atendimento via WhatsApp APENAS após persistência do pedido
   * e quando o estabelecimento possui contactPhone válido.
   */
  public static buildOrderWhatsAppUrl(params: {
    storePhone?: string | null;
    storeName: string;
    orderNumber: string;
    customerName: string;
    totalFormatted: string;
    deliveryMode: "pickup" | "delivery";
  }): string | null {
    const digits = this.normalizePhoneDigits(params.storePhone);
    if (digits.length < 10) return null;

    const internationalDigits =
      digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

    const modeLabel = params.deliveryMode === "delivery" ? "Entrega" : "Retirada na loja";
    const text = [
      `Olá, ${params.storeName}!`,
      `Acabei de enviar a solicitação do pedido *${params.orderNumber}*.`,
      `Cliente: ${params.customerName}`,
      `Modalidade: ${modeLabel}`,
      `Total solicitado: ${params.totalFormatted}`,
    ].join("\n");

    return `https://wa.me/${internationalDigits}?text=${encodeURIComponent(text)}`;
  }

  /**
   * Gera código legível único de pedido por estabelecimento (ex.: PED-A7K2M9).
   */
  public static generateOrderNumber(randomBytesHex?: string): string {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (randomBytesHex && randomBytesHex.length >= 12) {
      let code = "";
      for (let i = 0; i < 6; i++) {
        const byte = parseInt(randomBytesHex.slice(i * 2, i * 2 + 2), 16);
        code += alphabet[byte % alphabet.length];
      }
      return `PED-${code}`;
    }
    let fallback = "";
    for (let i = 0; i < 6; i++) {
      fallback += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `PED-${fallback}`;
  }
}
