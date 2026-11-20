import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleMarketingContactRequest,
  type HandlerConfig,
  type LeadRepository,
  type MarketingContactRecord,
} from "../supabase/functions/marketing-contact/handler.ts";

const VALID_ORIGIN = "https://devessent-landing.pages.dev";

function createValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Cliente Fictício",
    company: "Operação Teste Ltda",
    email: "teste.lead@example.com",
    whatsapp: "(11) 99999-1234",
    solution: "Desenvolvimento de sites",
    message: "Queremos publicar nossa landing page com alta performance.",
    privacyAccepted: true,
    turnstileToken: "valid-token-001",
    ...overrides,
  };
}

function createRepo(
  overrides: Partial<LeadRepository> = {}
): LeadRepository & { inserted: MarketingContactRecord[] } {
  const inserted: MarketingContactRecord[] = [];
  return {
    inserted,
    countRecentByIpHash: async () => 0,
    hasRecentDuplicate: async () => false,
    insertLead: async (record) => {
      inserted.push(record);
      return { id: "11111111-2222-3333-4444-555555555555" };
    },
    ...overrides,
  };
}

function createConfig(
  overrides: Partial<HandlerConfig> = {}
): HandlerConfig {
  return {
    allowedOrigins: [VALID_ORIGIN],
    allowedTurnstileHostnames: ["devessent-landing.pages.dev"],
    expectedTurnstileAction: "marketing_contact",
    turnstileSecretKey: "test-turnstile-secret-never-real",
    requireTurnstile: true,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: true,
          hostname: "devessent-landing.pages.dev",
          action: "marketing_contact",
        }),
        { status: 200 }
      ),
    ...overrides,
  };
}

function makePostRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request("https://example.supabase.co/functions/v1/marketing-contact", {
    method: "POST",
    headers: {
      Origin: VALID_ORIGIN,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
      "User-Agent": "DevEssent-Test-Agent/1.0",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("Supabase Edge Function: marketing-contact security & behavior", () => {
  it("handles CORS preflight for authorized origins and blocks unauthorized origins", async () => {
    const repo = createRepo();
    const config = createConfig();

    const allowedPreflight = await handleMarketingContactRequest(
      new Request("https://example.supabase.co/functions/v1/marketing-contact", {
        method: "OPTIONS",
        headers: { Origin: VALID_ORIGIN },
      }),
      repo,
      config
    );
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers.get("Access-Control-Allow-Origin"),
      VALID_ORIGIN
    );

    const blockedPost = await handleMarketingContactRequest(
      makePostRequest(createValidPayload(), { Origin: "https://evil.example" }),
      repo,
      config
    );
    assert.equal(blockedPost.status, 403);
    assert.equal(blockedPost.headers.get("Access-Control-Allow-Origin"), null);
  });

  it("enforces POST method, JSON content-type, and payload byte limit", async () => {
    const repo = createRepo();
    const config = createConfig({ maxBodyBytes: 512 });

    const getRes = await handleMarketingContactRequest(
      new Request("https://example.supabase.co/functions/v1/marketing-contact", {
        method: "GET",
        headers: { Origin: VALID_ORIGIN },
      }),
      repo,
      config
    );
    assert.equal(getRes.status, 405);

    const wrongType = await handleMarketingContactRequest(
      makePostRequest("name=test", { "Content-Type": "text/plain" }),
      repo,
      config
    );
    assert.equal(wrongType.status, 415);

    const oversized = await handleMarketingContactRequest(
      makePostRequest(createValidPayload({ message: "x".repeat(1000) })),
      repo,
      config
    );
    assert.equal(oversized.status, 413);
  });

  it("validates Turnstile token (missing, invalid, expired, reused, hostname mismatch)", async () => {
    const repo = createRepo();

    // Missing token
    const missing = await handleMarketingContactRequest(
      makePostRequest(createValidPayload({ turnstileToken: "" })),
      repo,
      createConfig()
    );
    assert.equal(missing.status, 400);

    // Invalid token
    const invalid = await handleMarketingContactRequest(
      makePostRequest(createValidPayload({ turnstileToken: "bad-token" })),
      repo,
      createConfig({
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              success: false,
              "error-codes": ["invalid-input-response"],
            })
          ),
      })
    );
    assert.equal(invalid.status, 403);

    // Expired / reused token
    const reused = await handleMarketingContactRequest(
      makePostRequest(createValidPayload({ turnstileToken: "reused-token" })),
      repo,
      createConfig({
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              success: false,
              "error-codes": ["timeout-or-duplicate"],
            })
          ),
      })
    );
    assert.equal(reused.status, 403);

    // Hostname mismatch
    const wrongHost = await handleMarketingContactRequest(
      makePostRequest(createValidPayload()),
      repo,
      createConfig({
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              success: true,
              hostname: "spoofed-host.invalid",
              action: "marketing_contact",
            })
          ),
      })
    );
    assert.equal(wrongHost.status, 403);
    assert.equal(repo.inserted.length, 0);
  });

  it("enforces rate limiting and duplicate submission protection", async () => {
    const rateLimited = await handleMarketingContactRequest(
      makePostRequest(createValidPayload()),
      createRepo({ countRecentByIpHash: async () => 5 }),
      createConfig({ rateLimitMaxPerWindow: 5 })
    );
    assert.equal(rateLimited.status, 429);

    const duplicate = await handleMarketingContactRequest(
      makePostRequest(createValidPayload()),
      createRepo({ hasRecentDuplicate: async () => true }),
      createConfig()
    );
    assert.equal(duplicate.status, 409);
  });

  it("inserts sanitized lead with hashed IP and logs zero PII or secrets", async () => {
    const logs: Record<string, unknown>[] = [];
    const repo = createRepo();
    const res = await handleMarketingContactRequest(
      makePostRequest(
        createValidPayload({
          name: "  <b>Ana Teste</b>  ",
          email: "ANA.TESTE@EXAMPLE.COM",
        })
      ),
      repo,
      createConfig({ logger: (entry) => logs.push(entry) })
    );

    assert.equal(res.status, 201);
    assert.equal(repo.inserted.length, 1);
    assert.equal(repo.inserted[0].name, "bAna Teste/b");
    assert.equal(repo.inserted[0].email, "ana.teste@example.com");
    assert.equal(repo.inserted[0].client_ip_hash.length, 64);

    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes("ana.teste@example.com"), false);
    assert.equal(serializedLogs.includes("203.0.113.10"), false);
    assert.equal(serializedLogs.includes("test-turnstile-secret"), false);
  });
});
