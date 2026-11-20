import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getScannerServerConfig, type ScannerServerConfig } from "./env";
import { createScannerAuthClient, createScannerPrivilegedClient } from "./supabase";
import type { AuthorizedOwnerSession } from "./types";

export const SCANNER_SESSION_COOKIE = "devessent_catalog_scanner_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

interface SignedSessionPayload {
  uid: string;
  email: string;
  fullName: string;
  at: string; // Supabase access_token (guardado em cookie HttpOnly assinado)
  exp: number;
}

export class ScannerAuthError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "ScannerAuthError";
    this.statusCode = statusCode;
  }
}

export function signScannerSessionToken(
  payload: SignedSessionPayload,
  secret: string
): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyScannerSessionToken(
  rawToken: string | undefined | null,
  secret: string
): SignedSessionPayload | null {
  if (!rawToken) return null;
  const parts = rawToken.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expectedSig = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1], "utf-8");
  const b = Buffer.from(expectedSig, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8")
    ) as Partial<SignedSessionPayload>;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.at !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (Date.now() >= parsed.exp) return null;

    return {
      uid: parsed.uid,
      email: parsed.email,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : parsed.email,
      at: parsed.at,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Verificação pura da regra de dupla autorização (§2):
 * 1. O usuário precisa estar explicitamente listado em `CATALOG_SCANNER_ALLOWED_USER_IDS`.
 * 2. Se `CATALOG_SCANNER_ALLOWED_EMAILS` estiver preenchido, o e-mail também precisa coincidir.
 * 3. O usuário precisa existir em `platform_admins` (nunca concede acesso a owners/managers/staff).
 * 4. Um `platform_admin` que NÃO esteja em `CATALOG_SCANNER_ALLOWED_USER_IDS` é BLOQUEADO.
 */
export function evaluateOwnerAuthorization(params: {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  config: Pick<ScannerServerConfig, "allowedUserIds" | "allowedEmails">;
}): { authorized: boolean; reason: string } {
  const uid = (params.userId || "").trim().toLowerCase();
  const email = (params.email || "").trim().toLowerCase();

  if (!uid) {
    return { authorized: false, reason: "Identidade de usuário ausente." };
  }

  if (!params.isPlatformAdmin) {
    return {
      authorized: false,
      reason:
        "Acesso negado: usuários de estabelecimentos (owner/manager/staff) não têm acesso ao DevEssent Catalog Scanner.",
    };
  }

  if (!params.config.allowedUserIds.includes(uid)) {
    return {
      authorized: false,
      reason:
        "Acesso negado: este usuário não está listado na configuração privativa de proprietários autorizados do Catalog Scanner.",
    };
  }

  if (
    params.config.allowedEmails.length > 0 &&
    !params.config.allowedEmails.includes(email)
  ) {
    return {
      authorized: false,
      reason:
        "Acesso negado: e-mail da conta não corresponde à allowlist privativa configurada.",
    };
  }

  return { authorized: true, reason: "Proprietário DevEssent autorizado." };
}

/**
 * Autentica o proprietário via Supabase Auth e valida dupla autorização antes de emitir cookie HttpOnly.
 */
export async function authenticateScannerOwner(
  email: string,
  password: string
): Promise<AuthorizedOwnerSession> {
  const config = getScannerServerConfig();
  const authClient = createScannerAuthClient();

  const { data, error } = await authClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user || !data.session) {
    throw new ScannerAuthError("Credenciais inválidas.", 401);
  }

  const adminClient = createScannerPrivilegedClient();
  const [{ data: adminRow }, { data: profileRow }] = await Promise.all([
    adminClient
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle(),
    adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle(),
  ]);

  const check = evaluateOwnerAuthorization({
    userId: data.user.id,
    email: data.user.email || "",
    isPlatformAdmin: Boolean(adminRow),
    config,
  });

  if (!check.authorized) {
    throw new ScannerAuthError(check.reason, 403);
  }

  const fullName =
    (typeof profileRow?.full_name === "string" && profileRow.full_name) ||
    (typeof data.user.user_metadata?.full_name === "string" &&
      data.user.user_metadata.full_name) ||
    data.user.email ||
    "Proprietário DevEssent";

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const signedToken = signScannerSessionToken(
    {
      uid: data.user.id,
      email: data.user.email || "",
      fullName,
      at: data.session.access_token,
      exp: expiresAt,
    },
    config.sessionSecret
  );

  const cookieStore = await cookies();
  cookieStore.set(SCANNER_SESSION_COOKIE, signedToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL?.includes("127.0.0.1"),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return {
    userId: data.user.id,
    email: data.user.email || "",
    fullName,
    accessToken: data.session.access_token,
    expiresAt,
  };
}

/**
 * Valida em CADA requisição de API / servidor:
 * 1. Cookie HMAC-SHA256 válido e não expirado.
 * 2. Sessão Supabase Auth real (`auth.getUser(accessToken)`).
 * 3. Dupla autorização (`CATALOG_SCANNER_ALLOWED_USER_IDS` + `platform_admins`).
 */
export async function requireScannerOwner(): Promise<AuthorizedOwnerSession> {
  const config = getScannerServerConfig();
  const cookieStore = await cookies();
  const raw = cookieStore.get(SCANNER_SESSION_COOKIE)?.value;

  const payload = verifyScannerSessionToken(raw, config.sessionSecret);
  if (!payload) {
    throw new ScannerAuthError("Sessão ausente ou expirada. Faça login novamente.", 401);
  }

  const authClient = createScannerAuthClient();
  const { data: userRes, error: userErr } = await authClient.auth.getUser(payload.at);
  if (userErr || !userRes.user || userRes.user.id !== payload.uid) {
    throw new ScannerAuthError("Sessão Supabase inválida ou revogada.", 401);
  }

  const adminClient = createScannerPrivilegedClient();
  const { data: adminRow } = await adminClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const check = evaluateOwnerAuthorization({
    userId: userRes.user.id,
    email: userRes.user.email || "",
    isPlatformAdmin: Boolean(adminRow),
    config,
  });

  if (!check.authorized) {
    throw new ScannerAuthError(check.reason, 403);
  }

  return {
    userId: userRes.user.id,
    email: userRes.user.email || "",
    fullName: payload.fullName,
    accessToken: payload.at,
    expiresAt: payload.exp,
  };
}

export async function clearScannerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SCANNER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
