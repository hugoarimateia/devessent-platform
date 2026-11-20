"use client";

import * as React from "react";
import { Lock, ScanBarcode, ShieldAlert, ShieldCheck } from "lucide-react";

interface LoginGateProps {
  supabaseHost: string;
  environment: string;
  onAuthenticated: (owner: { userId: string; email: string; fullName: string }) => void;
}

export function LoginGate({
  supabaseHost,
  environment,
  onAuthenticated,
}: LoginGateProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        owner?: { userId: string; email: string; fullName: string };
      };
      if (!res.ok || !data.ok || !data.owner) {
        setError(data.error || "Acesso negado.");
        return;
      }
      onAuthenticated(data.owner);
    } catch {
      setError("Falha de comunicação com o servidor local do Catalog Scanner.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Uso Exclusivo · Proprietário DevEssent</span>
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center">
              <ScanBarcode className="w-5 h-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                DevEssent Catalog Scanner
              </h1>
              <p className="text-xs text-slate-400">
                Digitalização e implantação assistida de catálogos Retail
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Ambiente alvo</span>
            <span className="font-mono font-semibold text-amber-300 uppercase">
              {environment}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Supabase Cloud</span>
            <span className="font-mono text-slate-200">{supabaseHost}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Autorização</span>
            <span className="font-mono text-emerald-300">Sessão + Allowlist UUID</span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-start gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="scanner-email"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              E-mail autorizado (DevEssent)
            </label>
            <input
              id="scanner-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="proprietario@devessent.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label
              htmlFor="scanner-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Senha
            </label>
            <input
              id="scanner-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? "Validando dupla autorização..." : "Entrar no Catalog Scanner"}</span>
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          Ferramenta privativa desconectada do painel público e dos clientes.
          Contas de lojistas (owner/manager/staff) e administradores fora da allowlist são bloqueadas automaticamente.
        </p>
      </div>
    </div>
  );
}
