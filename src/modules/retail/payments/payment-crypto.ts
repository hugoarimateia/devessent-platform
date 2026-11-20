import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { ForbiddenError, ValidationError } from "@/core/errors/app-error";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "VIOLAÇÃO DE SEGURANÇA: Operações criptográficas de credenciais financeiras são exclusivas do servidor."
    );
  }
}

function deriveEncryptionKey(tenantId: string): Buffer {
  assertServerOnly();
  const configuredSecret =
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    (process.env.NODE_ENV !== "production" ? process.env.XAMPP_SESSION_SECRET?.trim() : "") ||
    "";

  if (!configuredSecret && process.env.NODE_ENV === "production") {
    throw new Error(
      "VIOLAÇÃO CRÍTICA DE SEGURANÇA (Fail-Closed): PAYMENT_CREDENTIALS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY é obrigatória em produção/staging."
    );
  }

  const masterSecret =
    configuredSecret || "devessent-default-sandbox-key-material-32bytes";

  return createHmac("sha256", masterSecret)
    .update(`devessent:payment_vault:v1:${tenantId.toLowerCase()}`)
    .digest();
}

/**
 * Criptografa um segredo (access_token, refresh_token, webhook_secret) com AES-256-GCM
 * vinculado criptograficamente ao tenantId (AAD).
 */
export function encryptPaymentSecret(plainText: string, tenantId: string): string {
  assertServerOnly();
  const trimmed = plainText?.trim();
  if (!trimmed) {
    throw new ValidationError("Segredo financeiro vazio não pode ser criptografado.");
  }

  const key = deriveEncryptionKey(tenantId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`tenant:${tenantId.toLowerCase()}`, "utf-8"));

  const encrypted = Buffer.concat([cipher.update(trimmed, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Descriptografa um segredo com AES-256-GCM verificando integridade e vínculo com o tenantId.
 * Se tentado com tenantId diferente, falha imediatamente na verificação da AuthTag.
 */
export function decryptPaymentSecret(cipherPayload: string, tenantId: string): string {
  assertServerOnly();
  const parts = (cipherPayload || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new ForbiddenError("Formato inválido de credencial criptografada.");
  }

  try {
    const key = deriveEncryptionKey(tenantId);
    const iv = Buffer.from(parts[1], "base64url");
    const authTag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(`tenant:${tenantId.toLowerCase()}`, "utf-8"));
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    throw new ForbiddenError(
      "Falha na verificação criptográfica da credencial financeira do estabelecimento."
    );
  }
}

export interface PkceChallengePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/**
 * Gera par PKCE RFC 7636 (S256) para fluxos OAuth por vendedor (§4).
 */
export function generatePkceChallenge(): PkceChallengePair {
  assertServerOnly();
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export function verifyPkceChallenge(codeVerifier: string, expectedChallenge: string): boolean {
  if (!codeVerifier || !expectedChallenge) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed, "utf-8");
  const b = Buffer.from(expectedChallenge, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface OAuthStateClaims {
  tenantId: string;
  storeId: string;
  actorUserId: string;
  provider: "mercado_pago";
  codeChallenge: string;
  nonce: string;
  exp: number;
}

/**
 * Cria token `state` OAuth assinado com HMAC-SHA256 para impedir CSRF e associação
 * de conta comercial a outro tenant (§4).
 */
export function createSignedOAuthState(params: {
  tenantId: string;
  storeId: string;
  actorUserId: string;
  provider: "mercado_pago";
  codeChallenge: string;
  ttlSeconds?: number;
}): string {
  assertServerOnly();
  const claims: OAuthStateClaims = {
    tenantId: params.tenantId,
    storeId: params.storeId,
    actorUserId: params.actorUserId,
    provider: params.provider,
    codeChallenge: params.codeChallenge,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 600),
  };

  const encoded = Buffer.from(JSON.stringify(claims), "utf-8").toString("base64url");
  const key = deriveEncryptionKey("oauth-global-state");
  const sig = createHmac("sha256", key).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySignedOAuthState(params: {
  rawState: string;
  expectedTenantId: string;
  expectedActorUserId: string;
  codeVerifier: string;
}): OAuthStateClaims {
  assertServerOnly();
  const parts = (params.rawState || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ForbiddenError("Parâmetro OAuth 'state' inválido ou ausente.");
  }

  const key = deriveEncryptionKey("oauth-global-state");
  const expectedSig = createHmac("sha256", key).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1], "utf-8");
  const b = Buffer.from(expectedSig, "utf-8");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError("Assinatura do parâmetro OAuth 'state' inválida.");
  }

  let claims: OAuthStateClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8")) as OAuthStateClaims;
  } catch {
    throw new ForbiddenError("Estrutura do parâmetro OAuth 'state' corrompida.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < nowSec) {
    throw new ForbiddenError("Sessão de autorização OAuth expirada.");
  }

  if (claims.tenantId !== params.expectedTenantId) {
    throw new ForbiddenError(
      "VIOLAÇÃO MULTIEMPRESA: Tentativa de vincular conta OAuth a um estabelecimento diferente do solicitante."
    );
  }

  if (claims.actorUserId !== params.expectedActorUserId) {
    throw new ForbiddenError(
      "Identidade do usuário autorizador diverge da sessão que iniciou o fluxo OAuth."
    );
  }

  if (!verifyPkceChallenge(params.codeVerifier, claims.codeChallenge)) {
    throw new ForbiddenError("Validação PKCE (code_verifier) falhou para esta sessão OAuth.");
  }

  return claims;
}
