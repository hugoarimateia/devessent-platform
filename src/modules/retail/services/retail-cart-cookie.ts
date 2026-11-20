import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getBackendCookiePrefix } from "@/lib/environment/backend-mode";
import { isSecureCookieContext } from "@/lib/environment/cookie-options";

export function getStoreCartCookieName(storeSlug: string): string {
  const safeSlug = storeSlug.toLowerCase().replace(/[^a-z0-9-_]/g, "");
  return `${getBackendCookiePrefix()}_cart_${safeSlug}`;
}

export function generateOpaqueToken(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function verifyOpaqueTokenHash(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const candidate = Buffer.from(hashOpaqueToken(rawToken), "utf-8");
  const expected = Buffer.from(storedHash, "utf-8");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function readStoreCartToken(storeSlug: string): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getStoreCartCookieName(storeSlug))?.value?.trim();
    if (!token || token.length < 16 || token.length > 128) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export async function writeStoreCartToken(storeSlug: string, token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getStoreCartCookieName(storeSlug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function clearStoreCartToken(storeSlug: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getStoreCartCookieName(storeSlug), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(),
    path: "/",
    maxAge: 0,
  });
}

export function getStoreOrderReceiptCookieName(storeSlug: string, orderNumber: string): string {
  const safeSlug = storeSlug.toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const safeOrder = orderNumber.toUpperCase().replace(/[^A-Z0-9-_]/g, "");
  return `${getBackendCookiePrefix()}_receipt_${safeSlug}_${safeOrder}`;
}

export async function writeStoreOrderReceiptToken(
  storeSlug: string,
  orderNumber: string,
  token: string
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getStoreOrderReceiptCookieName(storeSlug, orderNumber), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function readStoreOrderReceiptToken(
  storeSlug: string,
  orderNumber: string
): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore
      .get(getStoreOrderReceiptCookieName(storeSlug, orderNumber))
      ?.value?.trim();
    if (!token || token.length < 16 || token.length > 128) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}
