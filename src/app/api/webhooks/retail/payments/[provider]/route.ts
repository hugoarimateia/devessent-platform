import { NextRequest, NextResponse } from "next/server";
import {
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors/app-error";
import {
  RATE_LIMIT_POLICIES,
  RateLimitService,
} from "@/core/security/rate-limit-service";
import { RetailPaymentService } from "@/modules/retail/services/retail-payment-service";
import type { RetailPaymentProviderName } from "@/modules/retail/types/retail.types";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024; // 64 KB
const ALLOWED_PROVIDERS = new Set<RetailPaymentProviderName>([
  "mercado_pago",
  "xampp_sandbox",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  if (!ALLOWED_PROVIDERS.has(rawProvider as RetailPaymentProviderName)) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_PROVIDER" },
      { status: 400 }
    );
  }

  const providerName = rawProvider as RetailPaymentProviderName;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  try {
    const rateKey = `${clientIp}:${providerName}`;
    await RateLimitService.assertNotBlocked(
      RATE_LIMIT_POLICIES.retailPaymentWebhook,
      rateKey
    );
    await RateLimitService.consumeOrThrow(
      RATE_LIMIT_POLICIES.retailPaymentWebhook,
      rateKey
    );

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
      );
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
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

    const result = await RetailPaymentService.processWebhookNotification({
      providerName,
      headers: headersMap,
      query: queryMap,
      rawBody,
    });

    return NextResponse.json(
      {
        ok: true,
        paymentId: result.paymentId,
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        processingResult: result.processingResult,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMIT_EXCEEDED" },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "WEBHOOK_SIGNATURE_INVALID" },
        { status: 401 }
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: "INVALID_WEBHOOK_PAYLOAD" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "WEBHOOK_PROCESSING_ERROR" },
      { status: 500 }
    );
  }
}
