import { describe, expect, it } from "vitest";
import { updateTenantSettingsSchema } from "@/core/tenants/schemas/settings.schema";

describe("TenantSettingsSchema — Fase 5B", () => {
  const basePayload = {
    display_name: "Loja Modelo Centro",
    contact_email: "contato@lojamodelo.test",
    segment_label: "Varejo",
    primary_color: "#5B46E5",
    monogram: "lm",
    brand_description: "Unidade piloto de validação.",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
  };

  it("aceita formatos válidos de telefone brasileiro e internacional E.164", () => {
    const validPhones = [
      "(11) 98888-1001",
      "(21) 3344-5566",
      "+55 11 98888-1001",
      "+5511988881001",
      "11 98888-1001",
      "",
      null,
    ];

    for (const phone of validPhones) {
      const parsed = updateTenantSettingsSchema.safeParse({
        ...basePayload,
        contact_phone: phone,
      });
      expect(parsed.success, `Telefone deveria ser válido: ${String(phone)}`).toBe(true);
    }
  });

  it("rejeita telefones malformados com mensagem amigável", () => {
    const invalidPhones = ["abc", "1234", "+011988881001", "(11) 98888-ABCD", "000000000"];

    for (const phone of invalidPhones) {
      const parsed = updateTenantSettingsSchema.safeParse({
        ...basePayload,
        contact_phone: phone,
      });
      expect(parsed.success, `Telefone deveria falhar: ${phone}`).toBe(false);
      if (!parsed.success) {
        const msg = parsed.error.flatten().fieldErrors.contact_phone?.[0];
        expect(msg).toContain("Telefone inválido");
      }
    }
  });

  it("normaliza monograma em maiúsculas e valida comprimento de 1 a 3 caracteres", () => {
    const valid = updateTenantSettingsSchema.safeParse({
      ...basePayload,
      monogram: " a2b ",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.monogram).toBe("A2B");
    }

    const tooLong = updateTenantSettingsSchema.safeParse({
      ...basePayload,
      monogram: "ABCD",
    });
    expect(tooLong.success).toBe(false);
  });

  it("valida cor primária em formato hexadecimal #RRGGBB", () => {
    const badColor = updateTenantSettingsSchema.safeParse({
      ...basePayload,
      primary_color: "azul",
    });
    expect(badColor.success).toBe(false);

    const goodColor = updateTenantSettingsSchema.safeParse({
      ...basePayload,
      primary_color: "#0F766E",
    });
    expect(goodColor.success).toBe(true);
  });
});

