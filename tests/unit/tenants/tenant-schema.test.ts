import { describe, it, expect } from "vitest";
import {
  slugSchema,
  createTenantSchema,
  RESERVED_SLUGS,
} from "@/core/tenants/schemas/tenant.schema";

describe("Tenant Schema Validation", () => {
  describe("slugSchema", () => {
    it("deve aceitar slugs válidos e bem formatados", () => {
      const validSlugs = [
        "atelier-sandbox",
        "verde-sandbox",
        "empresa-123",
        "padaria-do-joao",
        "xyz",
      ];
      for (const slug of validSlugs) {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(true);
      }
    });

    it("deve rejeitar slugs com caracteres especiais inválidos ou maiúsculas", () => {
      const invalidSlugs = [
        "Atelier-Sandbox",
        "loja_com_underline",
        "loja@comercial",
        "loja space",
        "empresa!",
      ];
      for (const slug of invalidSlugs) {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(false);
      }
    });

    it("deve rejeitar slugs com tamanho menor que 3 ou maior que 50 caracteres", () => {
      expect(slugSchema.safeParse("ab").success).toBe(false);
      expect(slugSchema.safeParse("a".repeat(51)).success).toBe(false);
    });

    it("deve rejeitar slugs com hífens duplos ou nas extremidades", () => {
      expect(slugSchema.safeParse("-empresa").success).toBe(false);
      expect(slugSchema.safeParse("empresa-").success).toBe(false);
      expect(slugSchema.safeParse("empresa--teste").success).toBe(false);
    });

    it("deve rejeitar todas as palavras reservadas do sistema", () => {
      for (const reserved of RESERVED_SLUGS) {
        const result = slugSchema.safeParse(reserved);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("createTenantSchema", () => {
    it("deve validar cadastro com dados corretos", () => {
      const input = {
        name: "Ateliê Sandbox",
        slug: "atelier-sandbox",
        ownerEmail: "owner@atelier.test",
        ownerFullName: "Proprietário Atelier",
      };
      const result = createTenantSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("deve falhar se o e-mail do proprietário for inválido", () => {
      const input = {
        name: "Ateliê Sandbox",
        slug: "atelier-sandbox",
        ownerEmail: "invalid-email",
        ownerFullName: "Proprietário Atelier",
      };
      const result = createTenantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("deve falhar se o nome for curto demais", () => {
      const input = {
        name: "A",
        slug: "atelier-sandbox",
        ownerEmail: "owner@atelier.test",
        ownerFullName: "Proprietário Atelier",
      };
      const result = createTenantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

