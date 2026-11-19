import { randomUUID } from "crypto";
import { PAYMENT_METHOD_LABELS, PaymentInvariants } from "../../domain/payment-invariants";
import {
  buildMercadoPagoWebhookSignature,
  MercadoPagoSandboxProvider,
} from "./mercado-pago-sandbox.provider";
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
import type { RetailPaymentStatus } from "../../types/retail.types";

/**
 * Adaptador financeiro determinístico para o ambiente local XAMPP/MariaDB (§3 e §16).
 * Não realiza chamadas externas à internet nem movimenta valores reais.
 */
export class XamppSandboxPaymentProvider implements RetailPaymentProvider {
  public readonly providerName = "xampp_sandbox" as const;
  public readonly environment = "sandbox" as const;
  private readonly delegate = new MercadoPagoSandboxProvider();

  public async createPaymentSession(
    input: CreatePaymentSessionInput
  ): Promise<CreatedPaymentSession> {
    PaymentInvariants.assertSandboxOnlyMode("sandbox", input.sellerAccessToken);
    const prefId = `XAMPP-PREF-${randomUUID().slice(0, 10).toUpperCase()}`;
    const separator = input.returnUrl.includes("?") ? "&" : "?";
    const checkoutUrl = `${input.returnUrl}${separator}sandbox_checkout=1&pref_id=${encodeURIComponent(prefId)}`;

    return {
      provider: "xampp_sandbox",
      environment: "sandbox",
      externalPreferenceId: prefId,
      externalReference: input.externalReference,
      checkoutUrl,
      expiresAt: input.expiresAt,
      rawMetadata: {
        mode: "xampp_deterministic_sandbox",
        sellerAccountId: input.sellerAccountId,
      },
    };
  }

  public async getTransaction(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord> {
    const rec = await this.delegate.getTransaction({
      ...params,
      sellerAccessToken: `TEST-DEVESSENT-SANDBOX-${params.sellerAccessToken}`,
    });
    return {
      ...rec,
      provider: "xampp_sandbox",
      paymentMethodLabel: PAYMENT_METHOD_LABELS[rec.paymentMethod] || "Sandbox Local",
    };
  }

  public validateWebhookNotification(
    input: ValidateWebhookNotificationInput
  ): ValidatedWebhookNotification {
    const validated = this.delegate.validateWebhookNotification(input);
    return {
      ...validated,
      externalEventId: validated.externalEventId.replace(/^mp:/, "xampp:"),
    };
  }

  public async cancelPayment(params: {
    externalPaymentId: string;
    sellerAccessToken: string;
  }): Promise<{ cancelled: boolean; status: RetailPaymentStatus }> {
    return this.delegate.cancelPayment({
      ...params,
      sellerAccessToken: `TEST-DEVESSENT-SANDBOX-${params.sellerAccessToken}`,
    });
  }

  public async requestRefund(input: RequestRefundInput): Promise<ConfirmedRefundRecord> {
    return this.delegate.requestRefund({
      ...input,
      sellerAccessToken: `TEST-DEVESSENT-SANDBOX-${input.sellerAccessToken}`,
    });
  }

  public async reconcilePayment(params: {
    externalPaymentId?: string | null;
    externalReference: string;
    sellerAccessToken: string;
    expectedSellerAccountId: string;
  }): Promise<AuthoritativeTransactionRecord | null> {
    const rec = await this.delegate.reconcilePayment({
      ...params,
      sellerAccessToken: `TEST-DEVESSENT-SANDBOX-${params.sellerAccessToken}`,
    });
    return rec ? { ...rec, provider: "xampp_sandbox" } : null;
  }

  public static buildSignedWebhookHeader(params: {
    dataId: string;
    xRequestId: string;
    timestampSeconds: number;
    webhookSecret: string;
  }): string {
    return buildMercadoPagoWebhookSignature(params);
  }
}
