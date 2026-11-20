"use client";

import React, { useState, useEffect, useRef } from "react";
import { SITE_CONFIG } from "@/config/site";
import { validateContactPayload } from "@/lib/contact";
import { TechSlantedBars } from "./TechDecor";

interface ContactResponse {
  ok: boolean;
  deliveryMode?: "supabase_edge" | "channel_assisted";
  leadId?: string;
  formattedBriefing?: string;
  configuredWhatsapp?: string;
  configuredEmail?: string;
  error?: string;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "dark" | "light" | "auto";
      action?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SERVICE_OPTIONS = [
  "Desenvolvimento de sites",
  "Landing pages",
  "Sistemas web",
  "Plataformas comerciais",
  "Automação de processos",
  "Integrações",
  ...SITE_CONFIG.solutions.map((s) => s.shortTitle),
  "Consultoria / Ainda não tenho certeza",
];

export function Contact({ initialService }: { initialService?: string }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [solution, setSolution] = useState(
    initialService && SERVICE_OPTIONS.includes(initialService)
      ? initialService
      : initialService || SERVICE_OPTIONS[0]
  );
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ContactResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const contactEndpoint = SITE_CONFIG.integrations.contactEndpoint;
  const supabaseAnonKey = SITE_CONFIG.integrations.supabaseAnonKey;
  const turnstileSiteKey = SITE_CONFIG.integrations.turnstileSiteKey;
  const requiresTurnstile = Boolean(contactEndpoint && turnstileSiteKey);

  useEffect(() => {
    if (initialService) {
      setSolution(initialService);
    }
  }, [initialService]);

  // Carrega o Cloudflare Turnstile sob demanda somente quando o backend e a site key estiverem configurados
  useEffect(() => {
    if (!requiresTurnstile || !turnstileContainerRef.current) return;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !turnstileContainerRef.current || !window.turnstile) {
        return;
      }
      if (turnstileWidgetIdRef.current) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Ignora caso o widget já tenha sido removido
        }
        turnstileWidgetIdRef.current = null;
      }
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: turnstileSiteKey,
          theme: "dark",
          action: "marketing_contact",
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        }
      );
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-turnstile-script="true"]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", mountWidget);
      } else {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        script.addEventListener("load", mountWidget);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          // Ignora na desmontagem
        }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [requiresTurnstile, turnstileSiteKey]);

  const resetTurnstile = () => {
    setTurnstileToken("");
    if (turnstileWidgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      } catch {
        // Ignora erro de reset do widget
      }
    }
  };

  const syncAriaInvalid = (
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  ) => {
    try {
      const isUserInvalid = el.matches(":user-invalid");
      el.setAttribute("aria-invalid", isUserInvalid ? "true" : "false");
    } catch {
      const isValid = el.checkValidity();
      el.setAttribute("aria-invalid", !isValid ? "true" : "false");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);

    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector<HTMLElement>(":invalid");
      firstInvalid?.focus();
      setErrorMsg("Por favor, revise os campos obrigatórios destacados.");
      return;
    }

    const validation = validateContactPayload({
      name,
      company,
      email,
      whatsapp,
      solution,
      message,
      privacyAccepted,
      website_url: honeypot,
      source: "devessent-landing-contact",
    });

    if (!validation.ok) {
      setErrorMsg(validation.error);
      return;
    }

    const configuredWhatsapp = SITE_CONFIG.contact.whatsapp.replace(/\D/g, "");
    const configuredEmail = SITE_CONFIG.contact.email.trim();

    // Modo 1: Encaminhamento assistido quando o endpoint Supabase de marketing não estiver habilitado
    if (!contactEndpoint) {
      setResult({
        ok: true,
        deliveryMode: "channel_assisted",
        formattedBriefing: validation.formattedBriefing,
        configuredWhatsapp,
        configuredEmail,
      });
      return;
    }

    if (requiresTurnstile && !turnstileToken) {
      setErrorMsg(
        "Conclua a verificação anti-spam antes de enviar sua solicitação."
      );
      return;
    }

    // Modo 2: Submissão segura para a Supabase Edge Function dedicada (marketing-contact)
    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (supabaseAnonKey) {
        headers.apikey = supabaseAnonKey;
        headers.Authorization = `Bearer ${supabaseAnonKey}`;
      }

      const response = await fetch(contactEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...validation.data,
          website_url: honeypot,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ContactResponse;

      if (!response.ok || !data.ok) {
        resetTurnstile();
        setErrorMsg(
          data.error ||
            "Não foi possível registrar no servidor neste momento. Você pode usar os canais diretos acima."
        );
      } else {
        resetTurnstile();
        setResult({
          ok: true,
          deliveryMode: "supabase_edge",
          leadId: data.leadId,
          formattedBriefing:
            data.formattedBriefing || validation.formattedBriefing,
          configuredWhatsapp,
          configuredEmail,
        });
      }
    } catch {
      resetTurnstile();
      setErrorMsg(
        "Falha de comunicação com o serviço de atendimento. Utilize WhatsApp, e-mail direto ou tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBriefing = async () => {
    if (!result?.formattedBriefing) return;
    try {
      await navigator.clipboard.writeText(result.formattedBriefing);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback caso clipboard API não esteja disponível
    }
  };

  const openPrivacyDialog = () => {
    const dialog = document.getElementById(
      "privacy-policy-dialog"
    ) as HTMLDialogElement | null;
    dialog?.showModal();
  };

  const whatsappDigits = (
    result?.configuredWhatsapp ||
    SITE_CONFIG.contact.whatsapp ||
    ""
  ).replace(/\D/g, "");
  const configuredEmail =
    result?.configuredEmail || SITE_CONFIG.contact.email || "";

  const whatsappUrl =
    whatsappDigits && result?.formattedBriefing
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
          result.formattedBriefing
        )}`
      : null;

  const mailtoUrl =
    configuredEmail && result?.formattedBriefing
      ? `mailto:${configuredEmail}?subject=${encodeURIComponent(
          `[DevEssent] Solicitação de Projeto — ${solution}`
        )}&body=${encodeURIComponent(result.formattedBriefing)}`
      : null;

  const allOptions = Array.from(
    new Set(
      initialService ? [initialService, ...SERVICE_OPTIONS] : SERVICE_OPTIONS
    )
  );

  return (
    <section
      id="formulario-contato"
      aria-labelledby="contact-heading"
      className="relative py-10 sm:py-14"
    >
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Coluna Esquerda (5 cols): Orientações do Atendimento */}
        <div className="lg:col-span-5">
          <div className="mb-4 inline-flex items-center gap-3">
            <span className="font-tech text-xs tracking-[0.3em] text-[#A782FF] uppercase">
              {"// BRIEFING DO PROJETO"}
            </span>
            <span className="h-[1px] w-10 bg-[#A782FF]/45" />
            <TechSlantedBars />
          </div>

          <h2
            id="contact-heading"
            className="font-display text-2xl leading-[1.18] font-bold tracking-tight text-[#E9E7DF] sm:text-3xl"
          >
            Descreva o cenário atual e o objetivo da{" "}
            <span className="text-[#A782FF]">sua operação.</span>
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
            Preencha os dados ao lado para estruturar sua demanda. Retornamos
            com uma avaliação técnica objetiva sobre escopo, prazos e
            arquitetura recomendada.
          </p>

          <div className="mt-8 space-y-4 rounded-[18px] border border-[#E9E7DF]/15 bg-[#14111D]/85 p-6">
            <h3 className="font-tech text-xs tracking-[0.22em] text-[#B695FF] uppercase">
              COMPROMISSO DEVESSENT
            </h3>
            <ul className="space-y-3 text-xs text-[#E9E7DF]/90 sm:text-sm">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#A782FF]"
                />
                <span>
                  <strong>Diagnóstico sem ruído:</strong> analisamos o que é
                  essencial construir agora para gerar resultado real.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#A782FF]"
                />
                <span>
                  <strong>Transparência sobre cada etapa:</strong> propostas
                  claras, prazos realistas e acompanhamento direto.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#A782FF]"
                />
                <span>
                  <strong>Sigilo e privacidade:</strong> as informações do seu
                  negócio são tratadas com confidencialidade e sem envio de
                  spam.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Coluna Direita (7 cols): Formulário Completo */}
        <div className="lg:col-span-7">
          <div className="rounded-[22px] border border-[#A782FF]/35 bg-gradient-to-br from-[#1A1626]/90 via-[#120F1B]/95 to-[#0D0B13]/98 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)] sm:p-9 lg:p-10">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate
              aria-label="Formulário de contato e solicitação de projeto"
              className="space-y-6"
            >
              {/* Campo Honeypot anti-spam */}
              <div className="visually-hidden" aria-hidden="true">
                <label htmlFor="website_url">Não preencha este campo</label>
                <input
                  type="text"
                  id="website_url"
                  name="website_url"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* 1. Nome completo */}
                <div>
                  <label
                    htmlFor="contact-name"
                    className="mb-1.5 block text-sm font-semibold text-[#E9E7DF]"
                  >
                    Nome completo <span className="text-[#A782FF]">*</span>
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    enterKeyHint="next"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={(e) => syncAriaInvalid(e.currentTarget)}
                    onInput={(e) => {
                      if (e.currentTarget.hasAttribute("aria-invalid")) {
                        syncAriaInvalid(e.currentTarget);
                      }
                    }}
                    aria-errormessage="name-error"
                    className="de-input"
                  />
                  <div id="name-error" className="de-field-error">
                    <span aria-hidden="true">▲</span>
                    <span>Informe seu nome completo (mínimo 2 caracteres).</span>
                  </div>
                </div>

                {/* 2. Empresa ou nome do negócio */}
                <div>
                  <label
                    htmlFor="contact-company"
                    className="mb-1.5 block text-sm font-semibold text-[#E9E7DF]"
                  >
                    Empresa ou nome do negócio{" "}
                    <span className="text-xs font-normal text-[#BAB5C5]">
                      (opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    id="contact-company"
                    name="company"
                    maxLength={120}
                    autoComplete="organization"
                    enterKeyHint="next"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="de-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* 3. E-mail */}
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-semibold text-[#E9E7DF]"
                  >
                    E-mail <span className="text-[#A782FF]">*</span>
                  </label>
                  <span
                    id="email-hint"
                    className="mb-1.5 block text-xs text-[#BAB5C5]"
                  >
                    Ex.: voce@suaempresa.com.br
                  </span>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    required
                    maxLength={160}
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    aria-describedby="email-hint"
                    aria-errormessage="email-error"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => syncAriaInvalid(e.currentTarget)}
                    onInput={(e) => {
                      if (e.currentTarget.hasAttribute("aria-invalid")) {
                        syncAriaInvalid(e.currentTarget);
                      }
                    }}
                    className="de-input"
                  />
                  <div id="email-error" className="de-field-error">
                    <span aria-hidden="true">▲</span>
                    <span>Informe um endereço de e-mail válido.</span>
                  </div>
                </div>

                {/* 4. WhatsApp */}
                <div>
                  <label
                    htmlFor="contact-whatsapp"
                    className="block text-sm font-semibold text-[#E9E7DF]"
                  >
                    WhatsApp <span className="text-[#A782FF]">*</span>
                  </label>
                  <span
                    id="whatsapp-hint"
                    className="mb-1.5 block text-xs text-[#BAB5C5]"
                  >
                    Com DDD — Ex.: (11) 99999-9999
                  </span>
                  <input
                    type="tel"
                    id="contact-whatsapp"
                    name="whatsapp"
                    required
                    minLength={8}
                    maxLength={40}
                    autoComplete="tel"
                    inputMode="tel"
                    enterKeyHint="next"
                    aria-describedby="whatsapp-hint"
                    aria-errormessage="whatsapp-error"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    onBlur={(e) => syncAriaInvalid(e.currentTarget)}
                    onInput={(e) => {
                      if (e.currentTarget.hasAttribute("aria-invalid")) {
                        syncAriaInvalid(e.currentTarget);
                      }
                    }}
                    className="de-input"
                  />
                  <div id="whatsapp-error" className="de-field-error">
                    <span aria-hidden="true">▲</span>
                    <span>Informe seu número de WhatsApp com DDD.</span>
                  </div>
                </div>
              </div>

              {/* 5. Tipo de serviço desejado */}
              <div>
                <label
                  htmlFor="contact-solution"
                  className="block text-sm font-semibold text-[#E9E7DF]"
                >
                  Tipo de serviço desejado{" "}
                  <span className="text-[#A782FF]">*</span>
                </label>
                <span
                  id="solution-hint"
                  className="mb-1.5 block text-xs text-[#BAB5C5]"
                >
                  Selecione o serviço ou solução principal para este projeto
                </span>
                <select
                  id="contact-solution"
                  name="solution"
                  required
                  aria-describedby="solution-hint"
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className="de-input bg-[#0B0B0B]"
                >
                  {allOptions.map((opt) => (
                    <option
                      key={opt}
                      value={opt}
                      className="bg-[#14111E] text-[#E9E7DF]"
                    >
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Descrição do projeto */}
              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-semibold text-[#E9E7DF]"
                >
                  Descrição do projeto <span className="text-[#A782FF]">*</span>
                </label>
                <span
                  id="message-hint"
                  className="mb-1.5 block text-xs text-[#BAB5C5]"
                >
                  Conte de forma simples o objetivo, funcionalidades desejadas
                  ou prazo estimado.
                </span>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  minLength={10}
                  maxLength={2000}
                  aria-describedby="message-hint"
                  aria-errormessage="message-error"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onBlur={(e) => syncAriaInvalid(e.currentTarget)}
                  onInput={(e) => {
                    if (e.currentTarget.hasAttribute("aria-invalid")) {
                      syncAriaInvalid(e.currentTarget);
                    }
                  }}
                  className="de-input min-h-[120px] resize-y"
                />
                <div id="message-error" className="de-field-error">
                  <span aria-hidden="true">▲</span>
                  <span>
                    Descreva brevemente o seu projeto (mínimo 10 caracteres).
                  </span>
                </div>
              </div>

              {/* Aviso de Privacidade (LGPD — finalidade exclusiva de atendimento, sem inscrição em newsletter) */}
              <div className="flex items-start gap-3 pt-1">
                <input
                  type="checkbox"
                  id="contact-privacy"
                  name="privacyAccepted"
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[#E9E7DF]/30 bg-[#0B0B0B] accent-[#A782FF]"
                />
                <label
                  htmlFor="contact-privacy"
                  className="text-xs leading-relaxed text-[#BAB5C5] sm:text-sm"
                >
                  Concordo com o uso dos dados informados exclusivamente para
                  retorno desta solicitação comercial (sem inscrição em listas
                  de marketing), conforme a{" "}
                  <button
                    type="button"
                    onClick={openPrivacyDialog}
                    className="font-medium text-[#B695FF] underline hover:text-[#E9E7DF]"
                  >
                    Política de Privacidade
                  </button>
                  . <span className="text-[#A782FF]">*</span>
                </label>
              </div>

              {/* Widget Cloudflare Turnstile (exibido apenas quando endpoint + sitekey estiverem ativos) */}
              {requiresTurnstile && (
                <div className="pt-1">
                  <div
                    ref={turnstileContainerRef}
                    aria-label="Verificação anti-spam Cloudflare Turnstile"
                  />
                </div>
              )}

              {/* Região de anúncio de erro ou resultado */}
              <div aria-live="polite" className="space-y-4">
                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#FF6B7A]/50 bg-[#FF6B7A]/10 px-4 py-3 text-xs text-[#FFB3BC] sm:text-sm"
                  >
                    {errorMsg}
                  </div>
                )}

                {result && result.deliveryMode === "supabase_edge" && (
                  <div className="space-y-2 rounded-xl border border-[#A782FF]/60 bg-[#A782FF]/15 p-5 text-sm text-[#E9E7DF]">
                    <p className="text-base font-semibold text-[#E9E7DF]">
                      ✓ Solicitação registrada com segurança!
                    </p>
                    <p className="text-xs text-[#BAB5C5] sm:text-sm">
                      Recebemos seu briefing técnico e entraremos em contato via{" "}
                      {email} ou WhatsApp ({whatsapp}).
                    </p>
                    {result.leadId && (
                      <p className="font-tech text-[11px] tracking-[0.14em] text-[#B695FF] uppercase">
                        Protocolo: {result.leadId.slice(0, 8)}
                      </p>
                    )}
                  </div>
                )}

                {result && result.deliveryMode === "channel_assisted" && (
                  <div className="space-y-4 rounded-xl border border-[#A782FF]/65 bg-[#161124]/95 p-5 text-sm text-[#E9E7DF] sm:p-6">
                    <div>
                      <span className="inline-block font-tech text-[0.62rem] tracking-[0.2em] text-[#B695FF] uppercase">
                        BRIEFING VALIDADO {"//"} ENCAMINHAMENTO DIRETO
                      </span>
                      <h4 className="mt-1 font-display text-base font-bold text-[#E9E7DF] sm:text-lg">
                        Resumo estruturado pronto para envio
                      </h4>
                    </div>

                    <p className="text-xs leading-relaxed text-[#BAB5C5] sm:text-sm">
                      Seu briefing técnico foi validado com sucesso. Escolha um
                      dos canais diretos abaixo ou copie o resumo estruturado
                      para iniciar o atendimento com a equipe DevEssent:
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-[#A782FF] px-4 py-2.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF] sm:text-sm"
                        >
                          <span>Enviar via WhatsApp</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}

                      {mailtoUrl && (
                        <a
                          href={mailtoUrl}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#A782FF]/60 bg-[#A782FF]/15 px-4 py-2.5 text-xs font-semibold text-[#E9E7DF] transition-colors hover:bg-[#A782FF]/25 sm:text-sm"
                        >
                          <span>Abrir no App de E-mail</span>
                          <span aria-hidden="true">✉</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyBriefing}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#E9E7DF]/25 bg-[#0B0B0B] px-4 py-2.5 text-xs font-medium text-[#E9E7DF] transition-colors hover:border-[#A782FF] sm:text-sm"
                      >
                        <span>
                          {copied
                            ? "✓ Briefing copiado!"
                            : "Copiar resumo estruturado"}
                        </span>
                      </button>
                    </div>

                    <pre className="overflow-x-auto rounded-lg border border-[#E9E7DF]/12 bg-[#0B0B0B]/90 p-3.5 font-mono text-xs whitespace-pre-wrap text-[#BAB5C5]">
                      {result.formattedBriefing}
                    </pre>
                  </div>
                )}
              </div>

              {/* Botão Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[11px] bg-gradient-to-r from-[#B695FF] to-[#A782FF] px-7 py-4 text-base font-semibold text-[#0B0B0B] shadow-[0_0_28px_rgba(167,130,255,0.35)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_38px_rgba(167,130,255,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="font-mono font-bold text-[#0B0B0B]/85"
                >
                  &lt;/&gt;
                </span>
                <span>
                  {isSubmitting
                    ? "Validando e enviando solicitação..."
                    : "Enviar Solicitação de Projeto"}
                </span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
