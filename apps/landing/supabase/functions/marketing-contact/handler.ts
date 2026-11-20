/**
 * Handler puro e testável da Edge Function `marketing-contact`.
 *
 * Controles de segurança obrigatórios:
 * - Método restrito a POST (e OPTIONS para preflight CORS)
 * - CORS restrito a origins explicitamente autorizados (nunca `*` em produção)
 * - Limite estrito de tamanho de payload (16 KB)
 * - Validação e sanitização server-side de todos os campos
 * - Verificação anti-spam via Honeypot + Cloudflare Turnstile Siteverify (sucesso, hostname, action)
 * - Rate limiting por hash de IP + prevenção de duplicidade em janela curta
 * - Persistência via cliente privilegiado injetado exclusivamente no backend
 * - Logs estruturados sem dados pessoais sensíveis nem segredos
 */

export interface MarketingContactRecord {
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  service_interest: string;
  message: string;
  source: string;
  privacy_consent: boolean;
  dedupe_hash: string;
  client_ip_hash: string;
  user_agent: string;
}

export interface LeadRepository {
  countRecentByIpHash: (ipHash: string, sinceIso: string) => Promise<number>;
  hasRecentDuplicate: (dedupeHash: string, sinceIso: string) => Promise<boolean>;
  insertLead: (record: MarketingContactRecord) => Promise<{ id: string }>;
}

export interface TurnstileVerificationResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export interface HandlerConfig {
  allowedOrigins: string[];
  allowedTurnstileHostnames: string[];
  expectedTurnstileAction: string;
  turnstileSecretKey: string;
  requireTurnstile: boolean;
  maxBodyBytes?: number;
  rateLimitMaxPerWindow?: number;
  rateLimitWindowSeconds?: number;
  dedupeWindowSeconds?: number;
  fetchImpl?: typeof fetch;
  logger?: (event: Record<string, unknown>) => void;
}

const DEFAULT_MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_SEC = 300;
const DEFAULT_DEDUPE_WINDOW_SEC = 600;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function resolveCorsOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[]
): string | null {
  if (!requestOrigin) return null;
  const normalized = requestOrigin.trim().replace(/\/$/, "");
  for (const allowed of allowedOrigins) {
    if (allowed.trim().replace(/\/$/, "") === normalized) {
      return normalized;
    }
  }
  return null;
}

function buildHeaders(corsOrigin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, apikey";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsOrigin: string | null
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(corsOrigin),
  });
}

async function verifyTurnstileToken(params: {
  secretKey: string;
  token: string;
  remoteIp: string;
  allowedHostnames: string[];
  expectedAction: string;
  fetchImpl: typeof fetch;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const formData = new URLSearchParams();
  formData.set("secret", params.secretKey);
  formData.set("response", params.token);
  if (params.remoteIp && params.remoteIp !== "unknown") {
    formData.set("remoteip", params.remoteIp);
  }

  const res = await params.fetchImpl(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    }
  );

  if (!res.ok) {
    return { ok: false, reason: "turnstile_upstream_error" };
  }

  const data = (await res.json()) as TurnstileVerificationResult;
  if (!data.success) {
    return {
      ok: false,
      reason: (data["error-codes"] || ["turnstile_rejected"]).join(","),
    };
  }

  if (params.allowedHostnames.length > 0) {
    const returnedHost = (data.hostname || "").toLowerCase();
    const hostAllowed = params.allowedHostnames.some(
      (h) => h.trim().toLowerCase() === returnedHost
    );
    if (!hostAllowed) {
      return { ok: false, reason: "turnstile_hostname_mismatch" };
    }
  }

  if (
    params.expectedAction &&
    data.action &&
    data.action !== params.expectedAction
  ) {
    return { ok: false, reason: "turnstile_action_mismatch" };
  }

  return { ok: true };
}

export async function handleMarketingContactRequest(
  request: Request,
  repo: LeadRepository,
  config: HandlerConfig
): Promise<Response> {
  const log = config.logger ?? (() => {});
  const requestOrigin = request.headers.get("origin");
  const corsOrigin = resolveCorsOrigin(requestOrigin, config.allowedOrigins);

  // Preflight CORS
  if (request.method === "OPTIONS") {
    if (requestOrigin && !corsOrigin) {
      return jsonResponse(
        { ok: false, error: "Origem não autorizada." },
        403,
        null
      );
    }
    return new Response(null, { status: 204, headers: buildHeaders(corsOrigin) });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Método HTTP não permitido." },
      405,
      corsOrigin
    );
  }

  if (requestOrigin && !corsOrigin) {
    log({ event: "marketing_contact_origin_blocked" });
    return jsonResponse(
      { ok: false, error: "Origem da requisição não autorizada." },
      403,
      null
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { ok: false, error: "Content-Type deve ser application/json." },
      415,
      corsOrigin
    );
  }

  const maxBodyBytes = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > maxBodyBytes) {
    return jsonResponse(
      { ok: false, error: "Payload excede o limite permitido." },
      413,
      corsOrigin
    );
  }

  const rawText = await request.text();
  if (new TextEncoder().encode(rawText).byteLength > maxBodyBytes) {
    return jsonResponse(
      { ok: false, error: "Payload excede o limite permitido." },
      413,
      corsOrigin
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_json_root");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, error: "JSON inválido no corpo da requisição." },
      400,
      corsOrigin
    );
  }

  // Honeypot anti-spam
  if (
    typeof body.website_url === "string" &&
    body.website_url.trim().length > 0
  ) {
    log({ event: "marketing_contact_honeypot_blocked" });
    return jsonResponse(
      { ok: false, error: "Submissão bloqueada pelo filtro anti-spam." },
      400,
      corsOrigin
    );
  }

  const name = sanitizeText(body.name, 120);
  const company = sanitizeText(body.company, 120);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const whatsapp = sanitizeText(body.whatsapp, 40);
  const solution = sanitizeText(body.solution, 140);
  const message = sanitizeText(body.message, 2000);
  const source = sanitizeText(
    body.source || "devessent-landing-contact",
    80
  );
  const privacyAccepted = body.privacyAccepted === true;
  const turnstileToken = sanitizeText(body.turnstileToken, 2048);

  if (name.length < 2) {
    return jsonResponse(
      { ok: false, error: "Informe seu nome completo (mínimo 2 caracteres)." },
      400,
      corsOrigin
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    return jsonResponse(
      { ok: false, error: "Informe um endereço de e-mail válido." },
      400,
      corsOrigin
    );
  }

  const whatsappDigits = whatsapp.replace(/\D/g, "");
  if (whatsappDigits.length < 8 || whatsappDigits.length > 15) {
    return jsonResponse(
      { ok: false, error: "Informe um número de WhatsApp válido com DDD." },
      400,
      corsOrigin
    );
  }

  if (solution.length < 2) {
    return jsonResponse(
      { ok: false, error: "Selecione o tipo de serviço desejado." },
      400,
      corsOrigin
    );
  }

  if (message.length < 10) {
    return jsonResponse(
      {
        ok: false,
        error: "Descreva brevemente o seu projeto (mínimo 10 caracteres).",
      },
      400,
      corsOrigin
    );
  }

  if (!privacyAccepted) {
    return jsonResponse(
      {
        ok: false,
        error:
          "É necessário concordar com a Política de Privacidade para enviar.",
      },
      400,
      corsOrigin
    );
  }

  const rawIp =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  // Verificação Cloudflare Turnstile obrigatória em produção
  if (config.requireTurnstile) {
    if (!config.turnstileSecretKey) {
      log({ event: "marketing_contact_turnstile_misconfigured" });
      return jsonResponse(
        { ok: false, error: "Serviço temporariamente indisponível." },
        503,
        corsOrigin
      );
    }

    if (!turnstileToken) {
      return jsonResponse(
        {
          ok: false,
          error: "Verificação anti-spam ausente. Conclua o desafio e tente novamente.",
        },
        400,
        corsOrigin
      );
    }

    const verification = await verifyTurnstileToken({
      secretKey: config.turnstileSecretKey,
      token: turnstileToken,
      remoteIp: rawIp,
      allowedHostnames: config.allowedTurnstileHostnames,
      expectedAction: config.expectedTurnstileAction,
      fetchImpl: config.fetchImpl ?? fetch,
    });

    if (!verification.ok) {
      log({
        event: "marketing_contact_turnstile_failed",
        reason: verification.reason,
      });
      return jsonResponse(
        {
          ok: false,
          error:
            "Validação anti-spam inválida ou expirada. Atualize a verificação e tente novamente.",
        },
        403,
        corsOrigin
      );
    }
  }

  // Rate limiting e prevenção de duplicidade baseados em hashes (sem logar PII)
  const ipHash = await sha256Hex(`ip:${rawIp}`);
  const dedupeHash = await sha256Hex(
    `lead:${email}|${solution.toLowerCase()}|${message.toLowerCase()}`
  );

  const rateLimitMax = config.rateLimitMaxPerWindow ?? DEFAULT_RATE_LIMIT_MAX;
  const rateLimitWindowSec =
    config.rateLimitWindowSeconds ?? DEFAULT_RATE_LIMIT_WINDOW_SEC;
  const dedupeWindowSec =
    config.dedupeWindowSeconds ?? DEFAULT_DEDUPE_WINDOW_SEC;

  const rateSinceIso = new Date(
    Date.now() - rateLimitWindowSec * 1000
  ).toISOString();
  const dedupeSinceIso = new Date(
    Date.now() - dedupeWindowSec * 1000
  ).toISOString();

  const recentCount = await repo.countRecentByIpHash(ipHash, rateSinceIso);
  if (recentCount >= rateLimitMax) {
    log({ event: "marketing_contact_rate_limited" });
    return jsonResponse(
      {
        ok: false,
        error:
          "Muitas solicitações em sequência. Aguarde alguns minutos e tente novamente.",
      },
      429,
      corsOrigin
    );
  }

  const isDuplicate = await repo.hasRecentDuplicate(dedupeHash, dedupeSinceIso);
  if (isDuplicate) {
    log({ event: "marketing_contact_duplicate_blocked" });
    return jsonResponse(
      {
        ok: false,
        error:
          "Esta solicitação já foi recebida recentemente. Nossa equipe entrará em contato.",
      },
      409,
      corsOrigin
    );
  }

  const userAgent = sanitizeText(request.headers.get("user-agent") || "", 240);

  const inserted = await repo.insertLead({
    name,
    company,
    email,
    whatsapp,
    service_interest: solution,
    message,
    source,
    privacy_consent: true,
    dedupe_hash: dedupeHash,
    client_ip_hash: ipHash,
    user_agent: userAgent,
  });

  log({
    event: "marketing_contact_created",
    leadId: inserted.id,
    source,
  });

  return jsonResponse(
    {
      ok: true,
      deliveryMode: "supabase_edge",
      leadId: inserted.id,
    },
    201,
    corsOrigin
  );
}
