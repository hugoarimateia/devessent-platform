import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { BACKEND_COOKIES } from "@/lib/environment/backend-mode";
import type { SessionUser } from "@/core/auth/types/auth.types";
import { assertXamppRuntimeAllowed, xamppQuery } from "./db";

interface XamppSessionPayload {
  userId: string;
  email: string;
  exp: number;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_path: string | null;
  is_platform_admin: number;
  created_at: Date | string;
}

function getSessionSecret(): string {
  assertXamppRuntimeAllowed();
  return (
    process.env.XAMPP_SESSION_SECRET ||
    "dev-xampp-local-session-secret-change-me-32chars"
  );
}

export function hashXamppPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyXamppPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;

  return timingSafeEqual(keyBuf, derivedBuf);
}

export function createXamppSessionToken(userId: string, email: string): string {
  const payload: XamppSessionPayload = {
    userId,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 8, // 8 horas
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyXamppSessionToken(token: string): XamppSessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    if (!encoded || !sig) return null;

    const expectedSig = createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    ) as XamppSessionPayload;

    if (!payload.userId || !payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export class XamppAuthAdapter {
  public static async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<
    | { success: true; user: SessionUser }
    | { success: false; error: string; isServiceUnavailable?: boolean }
  > {
    assertXamppRuntimeAllowed();

    try {
      const rows = await xamppQuery<UserRow[]>(
        "SELECT id, email, password_hash, full_name, avatar_path, is_platform_admin, created_at FROM users WHERE email = ? LIMIT 1",
        [credentials.email.trim().toLowerCase()]
      );

      if (!rows || rows.length === 0) {
        return {
          success: false,
          error: "E-mail ou senha incorretos. Verifique suas credenciais.",
        };
      }

      const userRow = rows[0];
      const valid = verifyXamppPassword(credentials.password, userRow.password_hash);
      if (!valid) {
        return {
          success: false,
          error: "E-mail ou senha incorretos. Verifique suas credenciais.",
        };
      }

      const token = createXamppSessionToken(userRow.id, userRow.email);
      const cookieStore = await cookies();
      cookieStore.set(BACKEND_COOKIES.xamppSession, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false, // Ambiente estritamente local HTTP
        maxAge: 60 * 60 * 8,
      });

      return {
        success: true,
        user: {
          id: userRow.id,
          email: userRow.email,
          fullName: userRow.full_name,
          avatarPath: userRow.avatar_path,
          createdAt: new Date(userRow.created_at).toISOString(),
          isPlatformAdmin: Boolean(userRow.is_platform_admin),
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar ao MariaDB.";
      if (msg.includes("indisponível") || msg.includes("devessent_test")) {
        return {
          success: false,
          error: msg,
          isServiceUnavailable: true,
        };
      }
      return {
        success: false,
        error: "Falha ao autenticar no ambiente de testes XAMPP.",
      };
    }
  }

  public static async getSessionUser(): Promise<SessionUser | null> {
    assertXamppRuntimeAllowed();

    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(BACKEND_COOKIES.xamppSession)?.value;
      if (!token) return null;

      const payload = verifyXamppSessionToken(token);
      if (!payload) return null;

      const rows = await xamppQuery<UserRow[]>(
        "SELECT id, email, full_name, avatar_path, is_platform_admin, created_at FROM users WHERE id = ? LIMIT 1",
        [payload.userId]
      );

      if (!rows || rows.length === 0) return null;
      const u = rows[0];

      return {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        avatarPath: u.avatar_path,
        createdAt: new Date(u.created_at).toISOString(),
        isPlatformAdmin: Boolean(u.is_platform_admin),
      };
    } catch {
      return null;
    }
  }

  public static async signOut(): Promise<void> {
    assertXamppRuntimeAllowed();
    const cookieStore = await cookies();
    cookieStore.delete(BACKEND_COOKIES.xamppSession);
    cookieStore.delete(BACKEND_COOKIES.xamppActiveTenant);
  }
}

