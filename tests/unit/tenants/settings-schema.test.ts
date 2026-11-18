import { describe, it, expect } from "vitest";
import { updateTenantSettingsSchema } from "@/core/tenants/schemas/settings.schema";

describe("Tenant Settings Schema Validation", () => {
  it("deve aceitar dados válidos com valores padrão brasileiros", () => {
    const input = {
      display_name: "Ateliê de Costura",
      contact_email: "contato@atelie.test",
      contact_phone: "+5511999998888",
    };

    const result = updateTenantSettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/Sao_Paulo");
      expect(result.data.locale).toBe("pt-BR");
    }
  });

  it("deve aceitar telefone vazio ou nulo", () => {
    const input = {
      display_name: "Ateliê",
      contact_phone: "",
    };

    const result = updateTenantSettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("deve rejeitar e-mail inválido", () => {
    const input = {
      display_name: "Ateliê",
      contact_email: "nao-eh-email",
    };

    const result = updateTenantSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("deve rejeitar nome de exibição menor que 2 caracteres", () => {
    const input = {
      display_name: "X",
    };

    const result = updateTenantSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

