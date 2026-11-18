import { describe, expect, it } from "vitest";
import { AuditService } from "@/core/audit/services/audit-service";
import { RateLimitError, ValidationError } from "@/core/errors/app-error";
import { getFieldErrorsFromError, toPublicErrorMessage } from "@/core/errors/public-error";

describe("AuditService.sanitizeMetadata & toPublicErrorMessage — Fase 5B", () => {
  it("remove recursivamente chaves sensíveis e redacta tokens JWT ou URLs de convite", () => {
    const jwtExample =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

    const circular: Record<string, unknown> = { ok: "valor-seguro" };
    circular.self = circular;

    const input = {
      email: "membro@empresa.test",
      token: "segredo-super-sensivel",
      nested: {
        password: "123",
        api_key: "secret-key",
        authorization: "Bearer abc",
        safeField: "mantido",
        inviteLink: "http://localhost:3000/convite/abcdef1234567890",
        payloadPreview: jwtExample,
        rawJwt: jwtExample,
      },
      events: [{ senha: "abc", role: "staff" }],
      deep: { l2: { l3: { l4: { l5: { l6: "excessive" } } } } },
      circular,
    };

    const sanitized = AuditService.sanitizeMetadata(input);

    expect(sanitized.email).toBe("membro@empresa.test");
    expect("token" in sanitized).toBe(false);

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.safeField).toBe("mantido");
    expect("password" in nested).toBe(false);
    expect("api_key" in nested).toBe(false);
    expect("authorization" in nested).toBe(false);
    expect(nested.inviteLink).toBe("[REDACTED]");
    expect(nested.payloadPreview).toBe("[REDACTED]");
    expect("rawJwt" in nested).toBe(false);

    const events = sanitized.events as Array<Record<string, unknown>>;
    expect(events[0].role).toBe("staff");
    expect("senha" in events[0]).toBe(false);

    const l5 = (
      ((sanitized.deep as Record<string, unknown>).l2 as Record<string, unknown>)
        .l3 as Record<string, unknown>
    ).l4 as Record<string, unknown>;
    expect(l5.l5).toBe("[TRUNCATED]");

    expect((sanitized.circular as Record<string, unknown>).self).toBe("[CIRCULAR]");
  });

  it("impede vazamento de mensagens SQLSTATE/PostgREST/JWT e preserva mensagens amigáveis", () => {
    expect(toPublicErrorMessage(new RateLimitError("Aguarde 30s.", 30))).toBe("Aguarde 30s.");
    expect(toPublicErrorMessage(new ValidationError("Nome obrigatório.", { name: ["Obrigatório"] }))).toBe(
      "Nome obrigatório."
    );

    const leakyAppError = new ValidationError('postgres SQLSTATE 23505 relation "tenants"');
    expect(toPublicErrorMessage(leakyAppError, "Falha genérica.")).toBe("Falha genérica.");

    expect(toPublicErrorMessage({ code: "23505", message: "duplicate key value violates unique" })).toBe(
      "Já existe um registro ativo com estes dados."
    );
    expect(toPublicErrorMessage({ code: "42501", message: "new row violates row-level security" })).toBe(
      "Você não possui permissão para executar esta operação."
    );
    expect(toPublicErrorMessage({ message: "over_request_rate_limit (429)" })).toContain(
      "Muitas solicitações"
    );
    expect(toPublicErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1"))).toContain(
      "Serviço temporariamente indisponível"
    );
    expect(toPublicErrorMessage(new Error("column foo does not exist"))).toBe(
      "Não foi possível concluir a operação. Tente novamente em instantes."
    );
  });

  it("extrai corretamente fieldErrors de ValidationError", () => {
    const err = new ValidationError("Inválido", {
      contact_phone: ["Telefone inválido", "Formato incorreto"],
      monogram: ["Máximo 3 caracteres"],
    });

    expect(getFieldErrorsFromError(err)).toEqual({
      contact_phone: "Telefone inválido",
      monogram: "Máximo 3 caracteres",
    });
    expect(getFieldErrorsFromError(new Error("outro"))).toBeUndefined();
  });
});
