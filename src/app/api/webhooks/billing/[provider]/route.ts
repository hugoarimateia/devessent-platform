import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import {
  RATE_LIMIT_POLICIES,
  RateLimitService,
} from "@/core/security/rate-limit-service";
import {
  BillingWebhookService,
  type BillingProviderName,
} from "@/modules/billing";

const MAX_BILLING_WEBHOOK_BYTES = 64 * 1024; // 64 KB
// Endpoint HTTP público aceita exclusivamente o provedor oficial configurado (`mercado_pago`).
// Simulações internas em Staging passam por autenticação Platform Admin + HMAC exclusivo.
const ALLOWED_BILLING_PROVIDERS = new Set<BillingProviderName>(["mercado_pago"]);

/**
 * Endpoint exclusivo de Webhooks do Billing SaaS da DevEssent (§11).
 * Completamente separado de `/api/webhooks/retail/payments/[provider]`.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  if (!ALLOWED_BILLING_PROVIDERS.has(rawProvider as BillingProviderName)) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_BILLING_PROVIDER" },
      { status: 400 }
    );
  }

  const providerName = rawProvider as BillingProviderName;
  const clientIp =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  const noStoreHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
  };

  try {
    const rateKey = `${clientIp}:${providerName}`;
    await RateLimitService.assertNotBlocked(RATE_LIMIT_POLICIES.billingWebhook, rateKey);
    await RateLimitService.consumeOrThrow(RATE_LIMIT_POLICIES.billingWebhook, rateKey);

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BILLING_WEBHOOK_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413, headers: noStoreHeaders }
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BILLING_WEBHOOK_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413, headers: noStoreHeaders }
      );
    }

    const headersMap: Record<string, string | undefined> = {
      "x-signature": request.headers.get("x-signature") ?? undefined,
      "x-request-id": request.headers.get("x-request-id") ?? undefined,
    };

    const queryMap: Record<string, string | undefined> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      queryMap[key] = value;
    });

    const result = await BillingWebhookService.processBillingWebhook({
      providerName,
      headers: headersMap,
      query: queryMap,
      rawBody,
    });

    return NextResponse.json(
      {
        ok: true,
        outcome: result.outcome,
        subscriptionId: result.subscriptionId,
        invoiceId: result.invoiceId,
        invoiceStatus: result.invoiceStatus,
        subscriptionStatus: result.subscriptionStatus,
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT_EXCEEDED" },
        {
          status: 429,
          headers: { ...noStoreHeaders, "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "BILLING_WEBHOOK_SIGNATURE_INVALID" },
        { status: 401, headers: noStoreHeaders }
      );
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: "BILLING_WEBHOOK_FORBIDDEN" },
        { status: 403, headers: noStoreHeaders }
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: "BILLING_SUBSCRIPTION_NOT_FOUND" },
        { status: 404, headers: noStoreHeaders }
      );
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BILLING_WEBHOOK_PAYLOAD" },
        { status: 400, headers: noStoreHeaders }
      );
    }
    return NextResponse.json(
      { ok: false, error: "BILLING_WEBHOOK_PROCESSING_ERROR" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
