import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatContactBriefing,
  sanitizeField,
  validateContactPayload,
} from "../src/lib/contact.ts";

describe("Landing Contact Validation & Briefing", () => {
  it("sanitizes angle brackets, control chars, and enforces max length", () => {
    const clean = sanitizeField("  <script>Olá\u0007 Mundo</script>  ", 20);
    assert.equal(clean, "scriptOlá Mundo/scri");
  });

  it("blocks honeypot submissions immediately", () => {
    const res = validateContactPayload({
      name: "Maria Silva",
      company: "Empresa Teste",
      email: "maria@example.com",
      whatsapp: "11999998888",
      solution: "Landing pages",
      message: "Quero criar uma landing page institucional rápida.",
      privacyAccepted: true,
      website_url: "https://spam-bot.invalid",
    });

    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "HONEYPOT_TRIGGERED");
  });

  it("rejects missing privacy consent and invalid fields", () => {
    const noConsent = validateContactPayload({
      name: "Maria Silva",
      company: "",
      email: "maria@example.com",
      whatsapp: "(11) 99999-8888",
      solution: "Landing pages",
      message: "Preciso de um site institucional para minha empresa.",
      privacyAccepted: false,
    });
    assert.equal(noConsent.ok, false);
    if (!noConsent.ok) assert.equal(noConsent.code, "PRIVACY_NOT_ACCEPTED");

    const badEmail = validateContactPayload({
      name: "Maria Silva",
      email: "email-invalido",
      whatsapp: "11999998888",
      solution: "Landing pages",
      message: "Preciso de um site institucional para minha empresa.",
      privacyAccepted: true,
    });
    assert.equal(badEmail.ok, false);
    if (!badEmail.ok) assert.equal(badEmail.code, "INVALID_EMAIL");
  });

  it("validates a complete payload and formats a structured briefing", () => {
    const res = validateContactPayload({
      name: "João Teste",
      company: "Studio Fictício",
      email: "JOAO@EXAMPLE.COM",
      whatsapp: "(11) 98888-7777",
      solution: "Desenvolvimento de sites",
      message: "Precisamos reformular nosso site institucional em Next.js.",
      privacyAccepted: true,
    });

    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.data.email, "joao@example.com");
      assert.ok(res.formattedBriefing.includes("João Teste"));
      assert.ok(res.formattedBriefing.includes("Studio Fictício"));
      assert.equal(
        formatContactBriefing(res.data),
        res.formattedBriefing
      );
    }
  });
});
