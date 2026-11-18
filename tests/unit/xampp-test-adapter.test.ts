import { afterEach, describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getAppBackendMode, isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  hashXamppPassword,
  verifyXamppPassword,
  createXamppSessionToken,
  verifyXamppSessionToken,
} from "@/infrastructure/xampp-test/auth";
import {
  resolveSafeStoragePath,
  XamppStorageAdapter,
} from "@/infrastructure/xampp-test/storage";

describe("Ambiente Secundário XAMPP/MariaDB — Isolamento, Sessão, Hash e Storage Local", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("1. getAppBackendMode utiliza 'supabase' por padrão e bloqueia 'xampp-test' em produção (fail-closed)", () => {
    delete process.env.APP_BACKEND_MODE;
    expect(getAppBackendMode()).toBe("supabase");
    expect(isXamppTestMode()).toBe(false);

    process.env.APP_BACKEND_MODE = "xampp-test";
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(() => getAppBackendMode()).toThrow(/proibido em produção/i);
    expect(isXamppTestMode()).toBe(false);
  });

  it("2. getAppBackendMode rejeita valores inválidos explicitamente", () => {
    process.env.APP_BACKEND_MODE = "sqlite-hack";
    expect(() => getAppBackendMode()).toThrow(/inválido/i);
  });

  it("3. hashXamppPassword e verifyXamppPassword utilizam salt aleatório + scrypt", () => {
    const hash1 = hashXamppPassword("XamppTest#2026!");
    const hash2 = hashXamppPassword("XamppTest#2026!");

    expect(hash1).not.toBe(hash2);
    expect(hash1.includes(":")).toBe(true);
    expect(verifyXamppPassword("XamppTest#2026!", hash1)).toBe(true);
    expect(verifyXamppPassword("SenhaErrada!", hash1)).toBe(false);
  });

  it("4. createXamppSessionToken e verifyXamppSessionToken validam assinatura HMAC e rejeitam adulterações", () => {
    process.env.APP_BACKEND_MODE = "xampp-test";
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.XAMPP_SESSION_SECRET = "test-secret-for-vitest-32-chars!!";

    const token = createXamppSessionToken("user-123", "tester@xampp.devessent.test");
    const decoded = verifyXamppSessionToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("user-123");
    expect(decoded?.email).toBe("tester@xampp.devessent.test");

    // Adulterar payload
    const [, sig] = token.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ userId: "admin", exp: Date.now() + 99999 })).toString("base64url")}.${sig}`;
    expect(verifyXamppSessionToken(tampered)).toBeNull();
  });

  it("5. Storage local bloqueia path traversal e formatos executáveis, aceitando imagens válidas", async () => {
    process.env.APP_BACKEND_MODE = "xampp-test";
    (process.env as Record<string, string>).NODE_ENV = "test";
    const tempStorage = "local-test/xampp/storage-vitest-tmp";
    process.env.XAMPP_STORAGE_DIR = tempStorage;

    // Bloqueia tentativa de path traversal para fora do diretório
    const safeResolved = resolveSafeStoragePath("../../etc/passwd");
    expect(safeResolved.startsWith(path.resolve(process.cwd(), tempStorage))).toBe(true);

    // Rejeita executável / PHP
    await expect(
      XamppStorageAdapter.saveProductImage({
        tenantId: "tenant-1",
        productId: "prod-1",
        mimeType: "application/x-php",
        buffer: Buffer.from("<?php echo 1; ?>"),
      })
    ).rejects.toThrow(/não permitido/i);

    // Aceita PNG válido e salva isolado por tenant
    const saved = await XamppStorageAdapter.saveProductImage({
      tenantId: "tenant-1",
      productId: "prod-1",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    expect(saved.storagePath.startsWith("tenant-1/prod-1/")).toBe(true);
    expect(saved.publicUrl).toBe(`/api/xampp-media/${saved.storagePath}`);

    const abs = resolveSafeStoragePath(saved.storagePath);
    expect(fs.existsSync(abs)).toBe(true);

    await XamppStorageAdapter.deleteProductImage(saved.storagePath);
    expect(fs.existsSync(abs)).toBe(false);

    fs.rmSync(path.resolve(process.cwd(), tempStorage), { recursive: true, force: true });
  });
});

