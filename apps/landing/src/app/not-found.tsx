import React from "react";
import Link from "next/link";
import { DevEssentLogo } from "@/components/DevEssentLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-4 text-center">
      <DevEssentLogo variant="navbar" className="mb-8" />
      <span className="font-tech text-xs tracking-[0.3em] text-[#B695FF] uppercase">
        404 {"//"} ROTA NÃO ENCONTRADA
      </span>
      <h1 className="mt-3 font-display text-3xl font-bold text-[#E9E7DF] sm:text-4xl">
        Página não encontrada
      </h1>
      <p className="mt-3 max-w-md text-sm text-[#BAB5C5]">
        O endereço acessado não existe ou foi movido. Retorne à página inicial
        da DevEssent para continuar sua navegação.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-[#A782FF] px-6 py-3 text-sm font-semibold text-[#0B0B0B] transition-colors hover:bg-[#B695FF]"
      >
        Voltar ao início
      </Link>
    </main>
  );
}

