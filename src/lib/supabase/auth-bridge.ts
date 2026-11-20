/**
 * Ponte criptográfica interna Middleware -> Server Components (Web Crypto API).
 *
 * Objetivo: eliminar o segundo roundtrip idêntico `supabase.auth.getUser()`
 * dentro da mesma requisição HTTP sem enfraquecer a segurança:
 * 1. O Middleware SEMPRE remove qualquer header `x-devessent-mw-auth` vindo do cliente.
 * 2. O Middleware valida a sessão autoritativamente via `supabase.auth.getUser()`.
 * 3. Após sucesso, assina com HMAC-SHA256 (segredo exclusivo de servidor) os dados mínimos
 *    do usuário vinculados ao fingerprint dos cookies Supabase da requisição e TTL de 10s.
 * 4. O Server Component verifica assinatura + TTL + fingerprint de cookie; qualquer falha
 *    faz fallback transparente para `supabase.auth.getUser()`.
 */
export const MW_AUTH_BRIDGE_HEADER = "x-devessent-mw-auth";
const BRIDGE_TTL_MS = 10_000;

export interface VerifiedMiddlewareAuthUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
}

interface BridgePayload {
  uid: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  ck: string;
  exp: number;
}

function getBridgeSecret(): string | null {
  const secret =
    process.env.AUTH_BRIDGE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.XAMPP_SESSION_SECRET?.trim() ||
    "";
  return secret.length >= 16 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function computeSupabaseCookieFingerprint(
  cookiesList: Array<{ name: string; value: string }>,
  cookiePrefix = "sb-"
): Promise<string> {
  const relevant = cookiesList
    .filter((c) => c.name.startsWith(cookiePrefix))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`)
    .join(";");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(relevant)
  );
  return toBase64Url(new Uint8Array(digest)).slice(0, 24);
}

async function signHmac(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function createMiddlewareAuthBridgeHeader(params: {
  user: VerifiedMiddlewareAuthUser;
  cookiesList: Array<{ name: string; value: string }>;
  cookiePrefix?: string;
}): Promise<string | null> {
  const secret = getBridgeSecret();
  if (!secret) return null;

  const ck = await computeSupabaseCookieFingerprint(
    params.cookiesList,
    params.cookiePrefix || "sb-"
  );

  const payload: BridgePayload = {
    uid: params.user.id,
    email: params.user.email,
    fullName: params.user.fullName,
    createdAt: params.user.createdAt,
    ck,
    exp: Date.now() + BRIDGE_TTL_MS,
  };

  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await signHmac(encoded, secret);
  return `${encoded}.${toBase64Url(sig)}`;
}

export async function verifyMiddlewareAuthBridgeHeader(params: {
  headerValue: string | null | undefined;
  cookiesList: Array<{ name: string; value: string }>;
  cookiePrefix?: string;
}): Promise<VerifiedMiddlewareAuthUser | null> {
  const raw = params.headerValue?.trim();
  if (!raw) return null;

  const secret = getBridgeSecret();
  if (!secret) return null;

  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;

  const encoded = raw.slice(0, dotIdx);
  const sigPart = raw.slice(dotIdx + 1);

  try {
    const providedSig = fromBase64Url(sigPart);
    const expectedSig = await signHmac(encoded, secret);
    if (!constantTimeEquals(providedSig, expectedSig)) {
      return null;
    }

    const decodedStr = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(decodedStr) as Partial<BridgePayload>;

    if (
      typeof payload.uid !== "string" ||
      !payload.uid ||
      typeof payload.exp !== "number" ||
      Date.now() > payload.exp ||
      typeof payload.ck !== "string"
    ) {
      return null;
    }

    const currentCk = await computeSupabaseCookieFingerprint(
      params.cookiesList,
      params.cookiePrefix || "sb-"
    );
    if (currentCk !== payload.ck) {
      return null;
    }

    return {
      id: payload.uid,
      email: typeof payload.email === "string" ? payload.email : "",
      fullName: typeof payload.fullName === "string" ? payload.fullName : null,
      createdAt:
        typeof payload.createdAt === "string"
          ? payload.createdAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
