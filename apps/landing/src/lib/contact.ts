export interface ContactFormPayload {
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  solution: string;
  message: string;
  privacyAccepted: boolean;
  website_url?: string;
  turnstileToken?: string;
  source?: string;
}

export interface SanitizedContactData {
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  solution: string;
  message: string;
  privacyAccepted: boolean;
  source: string;
}

export type ContactValidationResult =
  | { ok: true; data: SanitizedContactData; formattedBriefing: string }
  | { ok: false; error: string; code: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function sanitizeField(value: unknown, maxLen = 1000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function formatContactBriefing(data: SanitizedContactData): string {
  return [
    "=== SOLICITAÇÃO DE CONTATO // DEVESSENT ===",
    `Nome completo: ${data.name}`,
    `Empresa / Negócio: ${data.company || "Não informada"}`,
    `E-mail: ${data.email || "Não informado"}`,
    `WhatsApp: ${data.whatsapp || "Não informado"}`,
    `Tipo de serviço desejado: ${data.solution}`,
    "-------------------------------------------",
    "Descrição do projeto:",
    data.message,
    "===========================================",
  ].join("\n");
}

export function validateContactPayload(
  raw: Partial<ContactFormPayload>
): ContactValidationResult {
  if (raw.website_url && String(raw.website_url).trim().length > 0) {
    return {
      ok: false,
      code: "HONEYPOT_TRIGGERED",
      error: "Submissão bloqueada pelo filtro anti-spam.",
    };
  }

  const name = sanitizeField(raw.name, 120);
  const company = sanitizeField(raw.company, 120);
  const email = sanitizeField(raw.email, 160).toLowerCase();
  const whatsapp = sanitizeField(raw.whatsapp, 40);
  const solution = sanitizeField(raw.solution, 140);
  const message = sanitizeField(raw.message, 2000);
  const privacyAccepted = Boolean(raw.privacyAccepted);
  const source = sanitizeField(raw.source || "devessent-landing-contact", 80);

  if (name.length < 2) {
    return {
      ok: false,
      code: "INVALID_NAME",
      error: "Por favor, informe seu nome completo (mínimo 2 caracteres).",
    };
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      error: "Informe um endereço de e-mail válido para retorno.",
    };
  }

  const whatsappDigits = whatsapp.replace(/\D/g, "");
  if (whatsappDigits.length < 8 || whatsappDigits.length > 15) {
    return {
      ok: false,
      code: "INVALID_WHATSAPP",
      error: "Informe seu número de WhatsApp válido com DDD.",
    };
  }

  if (solution.length < 2) {
    return {
      ok: false,
      code: "INVALID_SOLUTION",
      error: "Selecione o tipo de serviço desejado.",
    };
  }

  if (message.length < 10) {
    return {
      ok: false,
      code: "INVALID_MESSAGE",
      error:
        "Descreva brevemente o seu projeto ou necessidade (mín. 10 caracteres).",
    };
  }

  if (!privacyAccepted) {
    return {
      ok: false,
      code: "PRIVACY_NOT_ACCEPTED",
      error:
        "É necessário concordar com a Política de Privacidade para prosseguir.",
    };
  }

  const data: SanitizedContactData = {
    name,
    company,
    email,
    whatsapp,
    solution,
    message,
    privacyAccepted,
    source,
  };

  return {
    ok: true,
    data,
    formattedBriefing: formatContactBriefing(data),
  };
}
