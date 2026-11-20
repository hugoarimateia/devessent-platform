import { afterEach, describe, expect, it, vi } from "vitest";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";
import { env } from "@/lib/environment/env";
import { encryptPaymentSecret } from "@/modules/retail/payments/payment-crypto";

describe("Fase 6E — Compatibilidade Cloudflare Workers & Hardening de Ambiente", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("define atributo Secure=true em HTTPS (Workers staging/prod) e false em localhost HTTP", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://devessent-platform-staging.devessent.workers.dev");
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureCookieContext()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureCookieContext()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:8787");
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureCookieContext()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureCookieContext()).toBe(true);
  });

  it("valida variáveis públicas sem exigir SUPABASE_SERVICE_ROLE_KEY no build, mas falha fechado ao acessá-la em runtime", () => {
    vi.stubEnv("APP_BACKEND_MODE", "supabase");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://devessent-platform-staging.devessent.workers.dev");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auebnppzxcvtaaqqlbts.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://auebnppzxcvtaaqqlbts.supabase.co");
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("staging");
    expect(() => env.SUPABASE_SERVICE_ROLE_KEY).toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.service.role");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.service.role"
    );
  });

  it("falha fechado no payment-crypto em NODE_ENV=production quando não há chave configurada", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_CREDENTIALS_ENCRYPTION_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("XAMPP_SESSION_SECRET", "should-be-ignored-in-production-mode");

    expect(() =>
      encryptPaymentSecret("TEST-TOKEN-123456", "10000000-0000-4000-8000-000000000001")
    ).toThrow(/FAIL-CLOSED/i);

    vi.stubEnv(
      "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
      "staging-aes-master-key-minimum-32-bytes-ok"
    );
    const encrypted = encryptPaymentSecret(
      "TEST-TOKEN-123456",
      "10000000-0000-4000-8000-000000000001"
    );
    expect(encrypted.startsWith("v1:")).toBe(true);
  });
});
