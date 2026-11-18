import { describe, it, expect } from "vitest";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sanitizeRedirectUrl,
} from "@/core/auth/validations/auth.schema";

describe("Unit Tests — Auth Validations & Schemas", () => {
  describe("loginSchema", () => {
    it("deve aceitar credenciais válidas e normalizar e-mail", () => {
      const result = loginSchema.safeParse({
        email: " Usuario.Teste@DevEssent.Test ",
        password: "MinhaSenha123!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("usuario.teste@devessent.test");
        expect(result.data.password).toBe("MinhaSenha123!");
      }
    });

    it("deve rejeitar e-mail inválido", () => {
      const result = loginSchema.safeParse({
        email: "email-invalido",
        password: "MinhaSenha123!",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar senha com menos de 6 caracteres", () => {
      const result = loginSchema.safeParse({
        email: "teste@devessent.test",
        password: "123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("deve validar formato correto de e-mail", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "recuperar@devessent.test",
      });
      expect(result.success).toBe(true);
    });

    it("deve rejeitar e-mail em branco", () => {
      const result = forgotPasswordSchema.safeParse({ email: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("deve aceitar nova senha e confirmação idênticas", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NovaSenhaForte123!",
        confirmPassword: "NovaSenhaForte123!",
      });
      expect(result.success).toBe(true);
    });

    it("deve rejeitar se a confirmação for diferente", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NovaSenhaForte123!",
        confirmPassword: "OutraSenha123!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
      }
    });
  });

  describe("sanitizeRedirectUrl (Open Redirect Protection)", () => {
    it("deve permitir caminhos relativos internos seguros", () => {
      expect(sanitizeRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/dashboard/settings")).toBe("/dashboard/settings");
      expect(sanitizeRedirectUrl("/admin")).toBe("/admin");
    });

    it("deve neutralizar URLs externas com protocolo", () => {
      expect(sanitizeRedirectUrl("https://evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("http://evil.com/hacked")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("data:text/html,...")).toBe("/dashboard");
    });

    it("deve neutralizar URLs maliciosas com barras duplas (//evil.com)", () => {
      expect(sanitizeRedirectUrl("//evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/\\evil.com")).toBe("/dashboard");
    });

    it("deve usar o fallback quando valor for nulo ou vazio", () => {
      expect(sanitizeRedirectUrl(null)).toBe("/dashboard");
      expect(sanitizeRedirectUrl(undefined)).toBe("/dashboard");
      expect(sanitizeRedirectUrl("")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("", "/admin")).toBe("/admin");
    });
  });
});

