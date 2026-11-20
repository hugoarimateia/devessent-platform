import { describe, it, expect } from "vitest";
import {
  AUTHORIZED_STAGING_PROJECT_REF,
  buildIsolatedStagingChildEnv,
  extractSupabaseCloudRef,
  type ValidatedStagingEnv,
} from "../../../scripts/lib/staging-env";

describe("Staging Environment Guard — Isolamento e Proteção de Destino", () => {
  it("aceita URL HTTPS oficial do Supabase Cloud Staging autorizado", () => {
    const parsed = extractSupabaseCloudRef(
      `https://${AUTHORIZED_STAGING_PROJECT_REF}.supabase.co`
    );
    expect(parsed.ref).toBe("auebnppzxcvtaaqqlbts");
    expect(parsed.host).toBe("auebnppzxcvtaaqqlbts.supabase.co");
  });

  it("bloqueia URLs HTTP ou locais (127.0.0.1 / localhost)", () => {
    expect(() => extractSupabaseCloudRef("http://127.0.0.1:54321")).toThrow(
      /CONFLITO DE AMBIENTE/i
    );
    expect(() => extractSupabaseCloudRef("https://localhost:54321")).toThrow(
      /CONFLITO DE AMBIENTE/i
    );
  });

  it("remove variáveis XAMPP/locais e injeta env de staging sem sobrescrita silenciosa", () => {
    const fakeValidated: ValidatedStagingEnv = {
      envFilePath: ".env.staging.local",
      projectRef: AUTHORIZED_STAGING_PROJECT_REF,
      supabaseUrl: `https://${AUTHORIZED_STAGING_PROJECT_REF}.supabase.co`,
      supabaseHost: `${AUTHORIZED_STAGING_PROJECT_REF}.supabase.co`,
      anonKey: "anon-placeholder-length-valid-123456",
      serviceRoleKey: "service-placeholder-length-valid-123456",
      appUrl: "http://localhost:3000",
      appEnv: "staging",
      rawVars: {},
    };

    const childEnv = buildIsolatedStagingChildEnv(fakeValidated, {
      NODE_ENV: "test",
      XAMPP_DB_HOST: "127.0.0.1",
      XAMPP_SESSION_SECRET: "secret-local-xampp",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });

    expect(childEnv.APP_BACKEND_MODE).toBe("supabase");
    expect(childEnv.NEXT_PUBLIC_APP_ENV).toBe("staging");
    expect(childEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(
      `https://${AUTHORIZED_STAGING_PROJECT_REF}.supabase.co`
    );
    expect(childEnv.XAMPP_DB_HOST).toBeUndefined();
    expect(childEnv.XAMPP_SESSION_SECRET).toBeUndefined();
    expect(childEnv.DATABASE_URL).toBeUndefined();
    expect(childEnv.NODE_OPTIONS).toContain("--dns-result-order=ipv4first");
  });
});
