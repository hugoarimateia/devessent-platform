import { createHash } from "crypto";
import { ForbiddenError, ValidationError } from "@/core/errors/app-error";
import type {
  BillingCycle,
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  ImplementationContractStatus,
  ImplementationInstallmentStatus,
  ManualPaymentMethod,
} from "../types/billing.types";

export const MAX_RECEIPT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  pix_manual: "Pix (transferência manual)",
  bank_transfer: "Transferência bancária (TED/DOC)",
  cash: "Dinheiro / Presencial",
  boleto_manual: "Boleto emitido fora da plataforma",
  card_machine: "Maquininha presencial",
  other: "Outro meio acordado",
};

export const SUBSCRIPTION_STATUS_META: Record<
  BillingSubscriptionStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  awaiting_activation: { label: "Aguardando ativação", tone: "info" },
  awaiting_authorization: { label: "Aguardando autorização financeira", tone: "warning" },
  active: { label: "Ativa", tone: "success" },
  pending_payment: { label: "Pagamento pendente", tone: "warning" },
  past_due: { label: "Em atraso (alerta administrativo)", tone: "danger" },
  in_regularization: { label: "Em regularização", tone: "info" },
  cancel_scheduled: { label: "Cancelamento agendado", tone: "warning" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const INVOICE_STATUS_META: Record<
  BillingInvoiceStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  scheduled: { label: "Agendada", tone: "neutral" },
  pending: { label: "Pendente", tone: "warning" },
  processing: { label: "Em processamento", tone: "info" },
  paid: { label: "Paga", tone: "success" },
  failed: { label: "Recusada", tone: "danger" },
  overdue: { label: "Vencida", tone: "danger" },
  refunded: { label: "Estornada", tone: "neutral" },
  void: { label: "Anulada", tone: "neutral" },
};

export const CONTRACT_STATUS_META: Record<
  ImplementationContractStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Rascunho", tone: "neutral" },
  awaiting_entry: { label: "Aguardando entrada (50%)", tone: "warning" },
  in_development: { label: "Em desenvolvimento", tone: "info" },
  delivered_awaiting_balance: { label: "Entregue · aguardando saldo (50%)", tone: "warning" },
  completed: { label: "Concluído e quitado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

export const INSTALLMENT_STATUS_META: Record<
  ImplementationInstallmentStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  pending: { label: "Pendente", tone: "warning" },
  receipt_attached: { label: "Comprovante anexado (não confirmado)", tone: "info" },
  confirmed: { label: "Recebimento confirmado", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const BillingInvariants = {
  /**
   * Formata valores inteiros em centavos para moeda brasileira sem aritmética flutuante insegura.
   */
  formatCentsToBrl(cents: number): string {
    const safe = Number.isFinite(cents) ? Math.trunc(cents) : 0;
    const isNegative = safe < 0;
    const abs = Math.abs(safe);
    const reais = Math.floor(abs / 100);
    const centavos = String(abs % 100).padStart(2, "0");
    const reaisFormatted = reais
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${isNegative ? "-" : ""}R$ ${reaisFormatted},${centavos}`;
  },

  /**
   * Converte string/número de valor em reais para centavos inteiros.
   */
  parseReaisToCents(input: string | number): number {
    if (typeof input === "number") {
      if (!Number.isFinite(input) || input <= 0) {
        throw new ValidationError("Informe um valor monetário válido maior que zero.");
      }
      return Math.round(input * 100);
    }
    const cleaned = input
      .trim()
      .replace(/^R\$\s*/i, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) {
      throw new ValidationError("Informe um valor monetário válido maior que zero.");
    }
    return Math.round(num * 100);
  },

  /**
   * Calcula divisão exata de contrato de implantação (padrão 50% entrada + 50% saldo)
   * usando apenas inteiros para garantir `entryCents + balanceCents === totalAmountCents`.
   */
  calculateImplementationSplit(
    totalAmountCents: number,
    entryPercent = 50
  ): { entryPercent: number; balancePercent: number; entryCents: number; balanceCents: number } {
    if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
      throw new ValidationError("O valor total do contrato deve ser um inteiro positivo em centavos.");
    }
    if (!Number.isInteger(entryPercent) || entryPercent < 0 || entryPercent > 100) {
      throw new ValidationError("O percentual de entrada deve estar entre 0% e 100%.");
    }
    const balancePercent = 100 - entryPercent;
    const entryCents = Math.floor((totalAmountCents * entryPercent) / 100);
    const balanceCents = totalAmountCents - entryCents;
    return { entryPercent, balancePercent, entryCents, balanceCents };
  },

  /**
   * Normaliza o valor contratual para Receita Recorrente Mensal (MRR) em centavos.
   */
  calculateMonthlyEquivalentCents(amountCents: number, cycle: BillingCycle): number {
    if (!Number.isInteger(amountCents) || amountCents <= 0) return 0;
    const divisor =
      cycle === "quarterly"
        ? 3
        : cycle === "semiannual"
        ? 6
        : cycle === "annual"
        ? 12
        : 1;
    return Math.round(amountCents / divisor);
  },

  /**
   * Bloqueia fail-closed qualquer tentativa de cobrança real (live) nas fases Sandbox (6E.2 / 6E.2C).
   *
   * IMPORTANTE (§4 — Fase 6E.2C):
   * Credenciais de teste oficiais do Mercado Pago também podem iniciar com `APP_USR-`.
   * Portanto, este guarda NUNCA presume que prefixo `TEST-` comprova sandbox nem que `APP_USR-`
   * é automaticamente produção: valida exclusivamente o ambiente declarado e o formato estrutural,
   * exigindo verificação autoritativa adicional em `GET /users/me` (`tags: ["test_user"]` +
   * `site_id: "MLB"` + `collector_id` esperado) antes de qualquer operação financeira oficial.
   */
  assertBillingSandboxOnly(environment: string, accessToken?: string): void {
    const normalizedEnv = environment.trim().toLowerCase();
    if (normalizedEnv !== "sandbox") {
      throw new ForbiddenError(
        "FAIL-CLOSED: O módulo DevEssent Billing SaaS opera exclusivamente em modo Sandbox nesta fase. Cobranças reais estão desabilitadas."
      );
    }
    if (accessToken !== undefined) {
      this.assertValidMercadoPagoTokenFormat(accessToken);
    }
  },

  /**
   * Valida formato estrutural de Access Token Mercado Pago (suporta formatos oficiais `TEST-*`
   * e `APP_USR-*` de contas de teste, rejeitando tokens vazios, curtos ou com espaços).
   * ATENÇÃO: formato válido NÃO comprova ambiente Sandbox; exige validação em `/users/me`.
   */
  assertValidMercadoPagoTokenFormat(accessToken: string): void {
    const trimmed = accessToken.trim();
    if (!trimmed || /\s/.test(trimmed) || trimmed.length < 24) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_ACCESS_TOKEN ausente ou com formato estrutural inválido."
      );
    }
    const hasKnownPrefix = trimmed.startsWith("TEST-") || trimmed.startsWith("APP_USR-");
    if (!hasKnownPrefix) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_ACCESS_TOKEN deve possuir prefixo oficial Mercado Pago (TEST- ou APP_USR- de conta de teste)."
      );
    }
  },

  /**
   * Verifica de forma fail-closed a resposta autoritativa de `GET /users/me` do Mercado Pago.
   * Única comprovação confiável de que um token (`APP_USR-*` ou `TEST-*`) pertence a uma
   * Conta de Teste oficial do Brasil (MLB) e ao `collector_id` autorizado da DevEssent.
   */
  assertOfficialSandboxUserIdentity(params: {
    userId: string | number | undefined | null;
    siteId: string | undefined | null;
    tags: unknown;
    expectedCollectorId: string;
  }): { collectorId: string; siteId: "MLB"; isTestUser: true } {
    const resolvedId = params.userId !== undefined && params.userId !== null ? String(params.userId).trim() : "";
    const expectedId = params.expectedCollectorId.trim();
    const resolvedSite = (params.siteId || "").trim().toUpperCase();
    const tagList = Array.isArray(params.tags)
      ? params.tags.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
      : [];
    const isTestUser = tagList.includes("test_user");

    if (!isTestUser) {
      throw new ForbiddenError(
        "FAIL-CLOSED: A credencial Mercado Pago configurada não pertence a uma Conta de Teste oficial (tag 'test_user' ausente em /users/me). Operação bloqueada para impedir risco de cobrança real."
      );
    }
    if (resolvedSite !== "MLB") {
      throw new ForbiddenError(
        `FAIL-CLOSED: Conta de teste Mercado Pago pertence ao país '${resolvedSite || "desconhecido"}'; obrigatório 'MLB' (Brasil / BRL).`
      );
    }
    if (!expectedId || !/^\d+$/.test(expectedId)) {
      throw new ForbiddenError(
        "FAIL-CLOSED: BILLING_MP_COLLECTOR_ID numérico da conta vendedora de teste DevEssent é obrigatório."
      );
    }
    if (!resolvedId || resolvedId !== expectedId) {
      throw new ForbiddenError(
        `FAIL-CLOSED: Titularidade divergente em /users/me (recebido collector '${resolvedId || "ausente"}', esperado '${expectedId}'). Operação bloqueada.`
      );
    }

    return { collectorId: resolvedId, siteId: "MLB", isTestUser: true };
  },

  /**
   * Compara timestamps autoritativos do provedor (`last_modified` / `date_last_updated`)
   * para impedir que um evento atrasado (mais antigo) sobrescreva uma atualização mais recente (§9E).
   * Não depende apenas do nome do estado.
   */
  evaluatePreapprovalTemporalOrdering(params: {
    lastRecordedProviderUpdatedAt: string | null | undefined;
    incomingProviderUpdatedAt: string | null | undefined;
  }): { isStale: boolean; lastMs: number | null; incomingMs: number | null } {
    const lastMs = params.lastRecordedProviderUpdatedAt
      ? Date.parse(params.lastRecordedProviderUpdatedAt)
      : Number.NaN;
    const incomingMs = params.incomingProviderUpdatedAt
      ? Date.parse(params.incomingProviderUpdatedAt)
      : Number.NaN;

    if (!Number.isFinite(lastMs) || !Number.isFinite(incomingMs)) {
      return {
        isStale: false,
        lastMs: Number.isFinite(lastMs) ? lastMs : null,
        incomingMs: Number.isFinite(incomingMs) ? incomingMs : null,
      };
    }

    return {
      isStale: incomingMs < lastMs,
      lastMs,
      incomingMs,
    };
  },

  /**
   * Compõe chave idempotente determinística para gatilhos sem `body.id`/`x-request-id` (IPN),
   * incorporando o timestamp autoritativo do provedor + estado para permitir retorno legítimo
   * a um estado anterior (`active -> past_due -> active`) enquanto deduplica reenvios idênticos (§9E).
   */
  buildAuthoritativeIpnEventKey(params: {
    resourceType: string;
    externalResourceId: string;
    providerUpdatedAt?: string | null;
    authoritativeStatus: string;
  }): string {
    const tsPart = params.providerUpdatedAt?.trim() || "no-ts";
    return `ipn:${params.resourceType}:${params.externalResourceId}:${tsPart}:${params.authoritativeStatus}`;
  },

  /**
   * Verifica se uma assinatura pode iniciar cobrança recorrente (§8):
   * exige autorização financeira válida + confirmação do marco contratual + não cancelada.
   */
  evaluateBillingStartReadiness(params: {
    status: BillingSubscriptionStatus;
    authorizedAt: string | null;
    activationConfirmedAt: string | null;
    scheduledStartDate: string;
    todayIsoDate?: string;
  }): { canCharge: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (params.status === "cancelled") {
      reasons.push("A assinatura encontra-se cancelada.");
    }
    if (!params.authorizedAt) {
      reasons.push("A autorização do meio de pagamento pelo empresário ainda não foi concluída.");
    }
    if (!params.activationConfirmedAt) {
      reasons.push("O marco contratual de ativação ainda não foi confirmado pela DevEssent.");
    }
    const today = params.todayIsoDate ?? new Date().toISOString().slice(0, 10);
    if (params.scheduledStartDate > today) {
      reasons.push(
        `A data agendada de início (${params.scheduledStartDate}) ainda não foi atingida.`
      );
    }
    return { canCharge: reasons.length === 0, reasons };
  },

  /**
   * Valida comprovante de implantação por magic bytes reais (PDF, PNG, JPEG, WebP) e tamanho <= 5 MB.
   */
  validateReceiptFileBuffer(
    buffer: Buffer,
    fileName: string
  ): { mimeType: string; extension: string; sha256: string; sizeBytes: number; safeFileName: string } {
    if (!buffer || buffer.byteLength < 8) {
      throw new ValidationError("Arquivo de comprovante vazio ou corrompido.");
    }
    if (buffer.byteLength > MAX_RECEIPT_FILE_BYTES) {
      throw new ValidationError("O comprovante excede o limite máximo permitido de 5 MB.");
    }

    let mimeType = "";
    let extension = "";

    // PDF: %PDF-
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      mimeType = "application/pdf";
      extension = "pdf";
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    else if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      mimeType = "image/png";
      extension = "png";
    }
    // JPEG: FF D8 FF
    else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mimeType = "image/jpeg";
      extension = "jpg";
    }
    // WebP: RIFF....WEBP
    else if (
      buffer.byteLength >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      mimeType = "image/webp";
      extension = "webp";
    } else {
      throw new ValidationError(
        "Formato de comprovante inválido pela assinatura binária. Envie PDF, PNG, JPEG ou WebP."
      );
    }

    const baseName = fileName
      .replace(/^.*[\\/]/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 80);
    const safeFileName = baseName || `comprovante.${extension}`;
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    return {
      mimeType,
      extension,
      sha256,
      sizeBytes: buffer.byteLength,
      safeFileName,
    };
  },

  /**
   * Gera chave canônica de ciclo mensal/periódico (ex.: "2026-11") para idempotência de faturas.
   */
  buildBillingCycleKey(isoDate: string): string {
    const clean = isoDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(clean)) {
      return new Date().toISOString().slice(0, 7);
    }
    return clean;
  },

  /**
   * Adiciona ciclo contratual (1/3/6/12 meses) sobre data ISO YYYY-MM-DD.
   */
  addBillingCycle(isoDate: string, cycle: BillingCycle): string {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
    const months =
      cycle === "quarterly" ? 3 : cycle === "semiannual" ? 6 : cycle === "annual" ? 12 : 1;
    const dt = new Date(Date.UTC(y, m - 1 + months, Math.min(d || 1, 28)));
    return dt.toISOString().slice(0, 10);
  },
};
