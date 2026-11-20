import React from "react";
import { SITE_CONFIG } from "@/config/site";

/**
 * Canais Diretos da Página Exclusiva /contato
 * - WhatsApp: Ícone, nome do canal, botão para iniciar conversa e link configurável
 * - Instagram: Ícone, perfil da empresa, botão para abrir o Instagram e link configurável
 * Sem inventar números nem URLs fictícias caso não configurados no ambiente.
 */
export function ContactChannels() {
  const rawWhatsapp = SITE_CONFIG.contact.whatsapp.replace(/\D/g, "");
  const rawInstagram = SITE_CONFIG.contact.instagram.trim();

  const whatsappHref = rawWhatsapp
    ? `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(
        "Olá! Vim pelo site da DevEssent e gostaria de conversar sobre um projeto."
      )}`
    : null;

  const instagramHref = rawInstagram
    ? rawInstagram.startsWith("http")
      ? rawInstagram
      : `https://instagram.com/${rawInstagram.replace(/^@/, "")}`
    : null;

  const instagramHandle = rawInstagram
    ? rawInstagram.startsWith("http")
      ? rawInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "")
      : rawInstagram.startsWith("@")
      ? rawInstagram
      : `@${rawInstagram}`
    : "@devessent";

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {/* Card 1: Canal WhatsApp */}
      <article className="flex flex-col justify-between rounded-[20px] border border-[#A782FF]/35 bg-gradient-to-br from-[#1B152A]/90 to-[#110E1A]/95 p-6 transition-all duration-300 hover:border-[#B695FF]/70">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#A782FF]/50 bg-[#161124] text-[#B695FF]">
              {/* Ícone WhatsApp Vetorial */}
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
              </svg>
            </div>

            <span className="rounded-md border border-[#A782FF]/35 bg-[#161124] px-2.5 py-1 font-tech text-[10px] tracking-[0.18em] text-[#B695FF] uppercase">
              CANAL DIRETO // 01
            </span>
          </div>

          <h2 className="font-display text-xl font-bold text-[#E9E7DF]">
            WhatsApp Comercial
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#BAB5C5] sm:text-sm">
            Atendimento ágil para alinhamento inicial de escopo, dúvidas
            técnicas e agendamento de diagnóstico.
          </p>
        </div>

        <div className="mt-6 border-t border-[#E9E7DF]/10 pt-4">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-between rounded-[10px] bg-[#A782FF] px-4 py-2.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF] sm:text-sm"
            >
              <span>Iniciar conversa no WhatsApp</span>
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <div className="space-y-2">
              <a
                href="#formulario-contato"
                className="inline-flex min-h-[44px] w-full items-center justify-between rounded-[10px] border border-[#A782FF]/45 bg-[#161124] px-4 py-2.5 text-xs font-semibold text-[#E9E7DF] transition-colors hover:border-[#B695FF] hover:bg-[#A782FF]/20 sm:text-sm"
              >
                <span>Iniciar conversa (preparar via formulário)</span>
                <span aria-hidden="true">↓</span>
              </a>
              <p className="font-tech text-[10px] tracking-[0.14em] text-[#BAB5C5]/70">
                Link direto configurável via NEXT_PUBLIC_CONTACT_WHATSAPP
              </p>
            </div>
          )}
        </div>
      </article>

      {/* Card 2: Canal Instagram */}
      <article className="flex flex-col justify-between rounded-[20px] border border-[#E9E7DF]/16 bg-gradient-to-br from-[#171324]/90 to-[#100D18]/95 p-6 transition-all duration-300 hover:border-[#A782FF]/65">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#A782FF]/50 bg-[#161124] text-[#B695FF]">
              {/* Ícone Instagram Vetorial */}
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </div>

            <span className="rounded-md border border-[#E9E7DF]/20 bg-[#1A1A1A] px-2.5 py-1 font-tech text-[10px] tracking-[0.18em] text-[#E9E7DF]/85 uppercase">
              PERFIL OFICIAL // 02
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-[#E9E7DF]">
              Instagram
            </h2>
            <span className="font-tech text-xs tracking-[0.12em] text-[#B695FF]">
              {instagramHandle}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#BAB5C5] sm:text-sm">
            Acompanhe bastidores de engenharia, conceitos visuais, evolução da
            suíte DevEssent e envie mensagens diretas.
          </p>
        </div>

        <div className="mt-6 border-t border-[#E9E7DF]/10 pt-4">
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-between rounded-[10px] border border-[#A782FF]/55 bg-[#161124] px-4 py-2.5 text-xs font-semibold text-[#E9E7DF] transition-colors hover:bg-[#A782FF] hover:text-[#0B0B0B] sm:text-sm"
            >
              <span>Abrir Instagram da DevEssent</span>
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <div className="space-y-2">
              <span className="inline-flex min-h-[44px] w-full items-center justify-between rounded-[10px] border border-[#E9E7DF]/18 bg-[#0B0B0B]/70 px-4 py-2.5 text-xs font-medium text-[#BAB5C5] sm:text-sm">
                <span>Abrir Instagram ({instagramHandle})</span>
                <span className="font-tech text-[10px] text-[#B695FF] uppercase">
                  Configurável
                </span>
              </span>
              <p className="font-tech text-[10px] tracking-[0.14em] text-[#BAB5C5]/70">
                URL configurável via NEXT_PUBLIC_CONTACT_INSTAGRAM
              </p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

