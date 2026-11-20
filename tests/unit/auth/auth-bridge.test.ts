import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMiddlewareAuthBridgeHeader,
  verifyMiddlewareAuthBridgeHeader,
} from "@/lib/supabase/auth-bridge";

describe("Middleware -> RSC Auth Bridge (HMAC-SHA256)", () => {
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sampleCookies = [
    { name: "sb-auebnppzxcvtaaqqlbts-auth-token.0", value: "chunk-alpha" },
    { name: "sb-auebnppzxcvtaaqqlbts-auth-token.1", value: "chunk-beta" },
    { name: "devessent_active_tenant", value: "tenant-123" },
  ];
  const sampleUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "gestor@devessent-demo.com",
    fullName: "Gestor Demo",
    createdAt: "2026-03-01T12:00:00.000Z",
  };

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-hmac-secret-key-minimum-32-chars";
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  it("valida assinatura HMAC-SHA256 e fingerprint de cookies na mesma requisição", async () => {
    const header = await createMiddlewareAuthBridgeHeader({
      user: sampleUser,
      cookiesList: sampleCookies,
    });
    expect(header).toBeTruthy();

    const verified = await verifyMiddlewareAuthBridgeHeader({
      headerValue: header,
      cookiesList: [...sampleCookies].reverse(),
    });
    expect(verified).toEqual(sampleUser);
  });

  it("rejeita payload adulterado (tentativa de spoofing de userId)", async () => {
    const header = await createMiddlewareAuthBridgeHeader({
      user: sampleUser,
      cookiesList: sampleCookies,
    });
    const [encoded, sig] = header!.split(".");
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Record<string, unknown>;
    decoded.uid = "22222222-2222-4222-8222-222222222222";
    const tampered = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${sig}`;

    const verified = await verifyMiddlewareAuthBridgeHeader({
      headerValue: tampered,
      cookiesList: sampleCookies,
    });
    expect(verified).toBeNull();
  });

  it("rejeita header quando cookies Supabase da requisição divergem (anti-replay entre sessões)", async () => {
    const header = await createMiddlewareAuthBridgeHeader({
      user: sampleUser,
      cookiesList: sampleCookies,
    });

    const verified = await verifyMiddlewareAuthBridgeHeader({
      headerValue: header,
      cookiesList: [
        { name: "sb-auebnppzxcvtaaqqlbts-auth-token.0", value: "different-session-token" },
      ],
    });
    expect(verified).toBeNull();
  });

  it("rejeita header expirado após TTL de 10 segundos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));

    const header = await createMiddlewareAuthBridgeHeader({
      user: sampleUser,
      cookiesList: sampleCookies,
    });

    vi.advanceTimersByTime(11_000);

    const verified = await verifyMiddlewareAuthBridgeHeader({
      headerValue: header,
      cookiesList: sampleCookies,
    });
    expect(verified).toBeNull();
  });

  it("prioriza AUTH_BRIDGE_SECRET dedicado quando configurado", async () => {
    const prevDedicated = process.env.AUTH_BRIDGE_SECRET;
    process.env.AUTH_BRIDGE_SECRET = "dedicated-cloudflare-auth-bridge-secret-32chars";
    try {
      const header = await createMiddlewareAuthBridgeHeader({
        user: sampleUser,
        cookiesList: sampleCookies,
      });
      expect(header).toBeTruthy();

      // Verificação com o mesmo AUTH_BRIDGE_SECRET funciona
      const verified = await verifyMiddlewareAuthBridgeHeader({
        headerValue: header,
        cookiesList: sampleCookies,
      });
      expect(verified).toEqual(sampleUser);

      // Se AUTH_BRIDGE_SECRET mudar, o token antigo é rejeitado mesmo com SUPABASE_SERVICE_ROLE_KEY igual
      process.env.AUTH_BRIDGE_SECRET = "another-dedicated-secret-value-at-least-32chars";
      const rejected = await verifyMiddlewareAuthBridgeHeader({
        headerValue: header,
        cookiesList: sampleCookies,
      });
      expect(rejected).toBeNull();
    } finally {
      if (prevDedicated === undefined) {
        delete process.env.AUTH_BRIDGE_SECRET;
      } else {
        process.env.AUTH_BRIDGE_SECRET = prevDedicated;
      }
    }
  });

  it("falha fechado (retorna null) quando nenhum segredo de servidor está configurado", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevBridge = process.env.AUTH_BRIDGE_SECRET;
    const prevEnc = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
    const prevXampp = process.env.XAMPP_SESSION_SECRET;
    delete process.env.AUTH_BRIDGE_SECRET;
    delete process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.XAMPP_SESSION_SECRET;

    try {
      const header = await createMiddlewareAuthBridgeHeader({
        user: sampleUser,
        cookiesList: sampleCookies,
      });
      expect(header).toBeNull();

      const verified = await verifyMiddlewareAuthBridgeHeader({
        headerValue: "abc.def",
        cookiesList: sampleCookies,
      });
      expect(verified).toBeNull();
    } finally {
      if (prevBridge !== undefined) process.env.AUTH_BRIDGE_SECRET = prevBridge;
      if (prevEnc !== undefined) process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = prevEnc;
      if (prevXampp !== undefined) process.env.XAMPP_SESSION_SECRET = prevXampp;
    }
  });
});
