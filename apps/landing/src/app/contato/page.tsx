import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ContactChannels } from "@/components/ContactChannels";
import { Contact } from "@/components/Contact";
import { ContactWithQuery } from "@/components/ContactWithQuery";
import { TechSlantedBars } from "@/components/TechDecor";

export const metadata: Metadata = {
  title: "Fale Conosco — Canais Diretos & Orçamento | DevEssent",
  description:
    "Entre em contato com a DevEssent via WhatsApp, Instagram ou formulário de projeto. Desenvolvemos sites, sistemas web e soluções digitais sob medida.",
  alternates: {
    canonical: "/contato",
  },
};

export default function ContatoPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 pt-24 pb-16 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
          {/* Cabeçalho da Página Exclusiva de Contato */}
          <div className="mb-10 border-b border-[#E9E7DF]/12 pb-10 sm:mb-12">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-3">
                <span className="font-tech text-xs font-semibold tracking-[0.3em] text-[#A782FF] uppercase">
                  {"// CANAL EXCLUSIVO DE ATENDIMENTO"}
                </span>
                <span className="h-[1px] w-12 bg-[#A782FF]/45" />
                <TechSlantedBars />
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-[#E9E7DF]/16 bg-[#161124]/60 px-3.5 py-2 text-xs font-medium text-[#BAB5C5] transition-colors hover:border-[#A782FF]/60 hover:text-[#E9E7DF]"
              >
                <span aria-hidden="true">←</span>
                <span>Voltar para a página inicial</span>
              </Link>
            </div>

            <h1 className="font-display text-3xl leading-[1.15] font-bold tracking-tight text-[#E9E7DF] sm:text-5xl">
              Seu próximo passo começa com uma{" "}
              <span className="text-[#A782FF]">conversa essencial.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#BAB5C5] sm:text-base">
              Escolha o canal direto de sua preferência ou preencha o briefing
              abaixo para receber um diagnóstico claro sobre o seu site,
              sistema ou automação.
            </p>
          </div>

          {/* Seção 1: Canais Diretos (WhatsApp & Instagram) */}
          <section aria-label="Canais diretos de contato" className="mb-10">
            <ContactChannels />
          </section>

          {/* Seção 2: Formulário Estruturado de Projeto */}
          <Suspense fallback={<Contact />}>
            <ContactWithQuery />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
