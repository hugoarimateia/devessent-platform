import Link from "next/link";
import { Store, ArrowLeft } from "lucide-react";

export default function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-[4px] border border-stone-200 shadow-sm text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-700">
          <Store className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold font-display uppercase tracking-wider text-stone-950">
            Loja Não Encontrada
          </h1>
          <p className="text-xs text-stone-500 font-light leading-relaxed">
            A vitrine que você tentou acessar não foi localizada, está temporariamente inativa
            ou pertence a um estabelecimento sem módulo Retail ativo.
          </p>
        </div>

        <div className="pt-4 border-t border-stone-100">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-950 text-white text-xs font-semibold uppercase tracking-wider rounded-[2px] hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retornar ao Painel</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

