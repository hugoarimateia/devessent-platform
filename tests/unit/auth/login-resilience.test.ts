import { describe, it, expect, vi } from "vitest";
import { AuthService, type AppSupabaseClient } from "@/core/auth/services/auth-service";

describe("Correção do Login — Resiliência contra Backend Indisponível", () => {
  it("1. signInWithPassword trata AuthRetryableFetchError sem lançar exceção não tratada", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: {
            name: "AuthRetryableFetchError",
            status: 0,
            message: "fetch failed",
          },
        }),
      },
    } as unknown as AppSupabaseClient;

    const result = await AuthService.signInWithPassword(mockSupabase, {
      email: "user@test.com",
      password: "Password123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("indisponível");
      expect(result.isServiceUnavailable).toBe(true);
    }
  });

  it("2. signInWithPassword trata rejeição de Promise de rede sem crashar Server Action", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:54321")),
      },
    } as unknown as AppSupabaseClient;

    const result = await AuthService.signInWithPassword(mockSupabase, {
      email: "user@test.com",
      password: "Password123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Não foi possível conectar");
      expect(result.isServiceUnavailable).toBe(true);
    }
  });

  it("3. signInWithPassword continua retornando erro genérico de credenciais para senha inválida", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: {
            name: "AuthApiError",
            status: 400,
            message: "Invalid login credentials",
          },
        }),
      },
    } as unknown as AppSupabaseClient;

    const result = await AuthService.signInWithPassword(mockSupabase, {
      email: "user@test.com",
      password: "wrong",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("E-mail ou senha incorretos. Verifique suas credenciais.");
      expect("isServiceUnavailable" in result).toBe(false);
    }
  });

  it("4. getSessionUser retorna null de forma segura quando o backend de autenticação cai", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      },
    } as unknown as AppSupabaseClient;

    const user = await AuthService.getSessionUser(mockSupabase);
    expect(user).toBeNull();
  });
});

