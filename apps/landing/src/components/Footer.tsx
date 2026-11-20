"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import { DevEssentLogo } from "./DevEssentLogo";
import { TechSlantedBars } from "./TechDecor";

export function Footer() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const openPrivacy = () => {
    dialogRef.current?.showModal();
  };

  const closePrivacy = () => {
    dialogRef.current?.close();
  };

  return (
    <footer
      id="site-footer"
      className="relative border-t border-[#E9E7DF]/12 bg-[#08070B] pt-14 pb-10 text-sm text-[#BAB5C5]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 border-b border-[#E9E7DF]/10 pb-12 md:grid-cols-12">
          {/* Coluna 1: Marca e Assinatura */}
          <div className="space-y-4 md:col-span-5">
            <Link
              href="/#inicio"
              aria-label="DevEssent — Voltar ao topo"
              className="inline-block"
            >
              <DevEssentLogo variant="subtitle" />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-[#BAB5C5]">
              {SITE_CONFIG.headline}{" "}
              <span className="text-[#E9E7DF]/85">{SITE_CONFIG.altSlogan}</span>
            </p>
            <div className="flex items-center gap-3 pt-1">
              <TechSlantedBars />
              <span className="font-tech text-[0.62rem] tracking-[0.24em] text-[#B695FF] uppercase">
                本質 {"//"} ESSENT
              </span>
            </div>
          </div>

          {/* Coluna 2: Navegação */}
          <nav aria-label="Rodapé" className="space-y-3 md:col-span-3">
            <span className="block font-tech text-xs tracking-[0.22em] text-[#E9E7DF] uppercase">
              Navegação
            </span>
            <ul className="space-y-2">
              {SITE_CONFIG.navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[#BAB5C5] transition-colors hover:text-[#A782FF]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="/contato"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B695FF] transition-colors hover:text-[#E9E7DF]"
                >
                  <span>Fale Conosco</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Coluna 3: Suíte de Soluções & Transparência */}
          <div className="space-y-3 md:col-span-4">
            <span className="block font-tech text-xs tracking-[0.22em] text-[#E9E7DF] uppercase">
              Suíte DevEssent
            </span>
            <ul className="space-y-2 text-xs text-[#BAB5C5] sm:text-sm">
              <li>DevEssent Web — Sites e sistemas sob medida</li>
              <li>DevEssent Pages — Landing pages de alta conversão</li>
              <li>DevEssent Catalog — Catálogos digitais com pedidos</li>
              <li>DevEssent Booking — Agendamento online</li>
              <li className="text-[#BAB5C5]/75">
                DevEssent Service{" "}
                <span className="font-tech text-[0.6rem] text-[#B695FF] uppercase">
                  [Em planejamento]
                </span>
              </li>
              <li className="text-[#BAB5C5]/75">
                DevEssent CRM{" "}
                <span className="font-tech text-[0.6rem] text-[#B695FF] uppercase">
                  [Em planejamento]
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Linha final de direitos e privacidade */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-[#BAB5C5]/80 sm:flex-row">
          <p>
            © {new Date().getFullYear()} DevEssent — Software House. Todos os
            direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={openPrivacy}
              className="underline underline-offset-4 transition-colors hover:text-[#E9E7DF]"
            >
              Política de Privacidade
            </button>
            <Link
              href="/#inicio"
              className="inline-flex items-center gap-1.5 text-[#B695FF] transition-colors hover:text-[#E9E7DF]"
            >
              <span>Topo</span>
              <span aria-hidden="true">↑</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Modal Nativo <dialog> de Política de Privacidade */}
      <dialog
        ref={dialogRef}
        id="privacy-policy-dialog"
        aria-labelledby="privacy-dialog-title"
        onClick={(e) => {
          if (e.target === dialogRef.current) closePrivacy();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-[20px] border border-[#A782FF]/45 bg-[#120F1C] p-6 text-[#E9E7DF] shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:p-8"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#E9E7DF]/12 pb-4">
          <div>
            <span className="font-tech text-[0.65rem] tracking-[0.22em] text-[#B695FF] uppercase">
              TRANSPARÊNCIA & DADOS
            </span>
            <h2
              id="privacy-dialog-title"
              className="mt-1 font-display text-xl font-bold text-[#E9E7DF]"
            >
              Política de Privacidade — DevEssent
            </h2>
          </div>
          <button
            type="button"
            onClick={closePrivacy}
            aria-label="Fechar Política de Privacidade"
            className="rounded-lg border border-[#E9E7DF]/20 px-3 py-1.5 text-xs text-[#BAB5C5] hover:border-[#A782FF] hover:text-[#E9E7DF]"
          >
            Fechar ✕
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-[#BAB5C5] sm:text-sm">
          <p>
            A <strong>DevEssent</strong> coleta apenas os dados estritamente
            necessários informados voluntariamente no formulário de contato
            (nome, empresa opcional, e-mail, WhatsApp, tipo de serviço e
            descrição do projeto) com a finalidade exclusiva de analisar e
            responder à sua solicitação comercial.
          </p>
          <p>
            O envio do formulário <strong>não</strong> realiza inscrição
            automática em listas de marketing ou newsletters. Não comercializamos
            dados pessoais com terceiros e não utilizamos rastreadores invasivos
            de publicidade.
          </p>
          <p>
            Quando a persistência segura em banco de marketing estiver ativa, os
            registros são mantidos somente pelo período necessário ao
            atendimento comercial e histórico de proposta, em ambiente restrito
            sem exposição pública. Para solicitar acesso, correção ou exclusão
            de dados conforme a LGPD, entre em contato pelos canais oficiais da
            DevEssent.
          </p>
        </div>

        <div className="mt-6 flex justify-end border-t border-[#E9E7DF]/12 pt-4">
          <button
            type="button"
            onClick={closePrivacy}
            className="rounded-lg bg-[#A782FF] px-5 py-2.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF] sm:text-sm"
          >
            Entendi
          </button>
        </div>
      </dialog>
    </footer>
  );
}
