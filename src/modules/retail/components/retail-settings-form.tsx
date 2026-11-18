"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Save,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Palette,
} from "lucide-react";
import type { RetailStore } from "../types";
import { updateRetailStoreAction } from "../actions/retail-store.actions";

interface RetailSettingsFormProps {
  tenantId: string;
  store: RetailStore;
  userRole: string;
}

/**
 * Painel de Configurações Operacionais da Loja (Cliente).
 * Conforme política de separação de responsabilidades (Fase 6B.1),
 * controles estruturais de layout, template e identidade visual da vitrine pública
 * são reservados exclusivamente à equipe DevEssent no Console Técnico.
 */
export function RetailSettingsForm({
  tenantId,
  store,
  userRole,
}: RetailSettingsFormProps) {
  const router = useRouter();
  const canWrite =
    userRole === "owner" || userRole === "manager" || userRole === "platform_admin";
  const isPlatformAdmin = userRole === "platform_admin";

  // Parâmetros Operacionais Permitidos ao Cliente
  const [storeName, setStoreName] = React.useState(store.storeName);
  const [currency, setCurrency] = React.useState(store.currency);
  const [isActive, setIsActive] = React.useState(store.isActive);
  const [inventoryMode, setInventoryMode] = React.useState<"track_quantity" | "untracked">(
    store.inventoryMode
  );

  // Contatos & Canais Comerciais Autorizados
  const [contactEmail, setContactEmail] = React.useState(store.contactEmail || "");
  const [contactPhone, setContactPhone] = React.useState(store.contactPhone || "");
  const [instagram, setInstagram] = React.useState(store.socialLinks?.instagram || "");
  const [tiktok, setTiktok] = React.useState(store.socialLinks?.tiktok || "");
  const [youtube, setYoutube] = React.useState(store.socialLinks?.youtube || "");

  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || loading) return;

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("storeName", storeName);
    formData.append("currency", currency);
    formData.append("isActive", String(isActive));
    formData.append("inventoryMode", inventoryMode);
    formData.append("contactEmail", contactEmail);
    formData.append("contactPhone", contactPhone);
    formData.append("social_instagram", instagram);
    formData.append("social_tiktok", tiktok);
    formData.append("social_youtube", youtube);

    const res = await updateRetailStoreAction(tenantId, null, formData);
    setLoading(false);

    if (!res.success) {
      setFeedback({ text: res.error || "Erro ao salvar configurações.", error: true });
    } else {
      setFeedback({
        text: "Configurações operacionais e canais de atendimento atualizados com sucesso!",
      });
      router.refresh();
    }
  };

  const storeSlug = store.slug;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Banner da Vitrine Publicada (Somente Visualização do Site Ativo) */}
      {storeSlug && (
        <section
          aria-label="Vitrine pública ativa"
          className="bg-surface p-5 sm:p-6 rounded-2xl border border-surface-border shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-accent block">
              Site & Vitrine Pública em Operação
            </span>
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm font-bold font-mono text-foreground">
                /loja/{storeSlug}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                {store.isActive ? "Vitrine Online" : "Vitrine Pausada"}
              </span>
            </div>
            <p className="text-xs text-foreground-muted max-w-[58ch]">
              Confira seus produtos e coleções publicados exatamente como aparecem no site oficial entregue para sua marca.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={`/loja/${storeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-semibold transition-opacity shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Visualizar Vitrine Ativa</span>
            </a>

            {isPlatformAdmin && (
              <Link
                href={`/admin/sites?tenantId=${tenantId}`}
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-accent/35 bg-accent/10 text-accent hover:bg-accent/15 text-xs font-semibold transition-colors"
              >
                <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Console Técnico (DevEssent)</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Aviso Claro de Governança Técnica vs Operação */}
      <aside className="rounded-2xl border border-surface-border bg-surface-muted/45 p-4 sm:p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">
            Arquitetura visual mantida pela equipe DevEssent
          </p>
          <p className="text-foreground-muted leading-relaxed">
            Para preservar a qualidade e estabilidade do site desenvolvido sob medida para o seu negócio, alterações estruturais de layout, tipografia, paleta de cores e seções do storefront são realizadas exclusivamente pela equipe técnica DevEssent mediante solicitação. Aqui você gerencia os parâmetros operacionais da loja, estoque e canais de atendimento.
          </p>
        </div>
      </aside>

      {/* Formulário Operacional da Loja */}
      <section className="bg-surface p-6 sm:p-8 rounded-2xl border border-surface-border shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-surface-border pb-4 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--t-tint, rgba(91, 70, 229, 0.08))",
              color: "var(--t-ink, var(--accent))",
            }}
          >
            <Store className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-display text-foreground">
              Configurações Operacionais da Loja
            </h1>
            <p className="text-xs text-foreground-muted">
              Parâmetros comerciais, controle de estoque e contatos de atendimento ao cliente
            </p>
          </div>
        </div>

        {!canWrite && (
          <div
            role="status"
            className="mb-6 p-3.5 rounded-xl border border-surface-border bg-surface-muted/60 text-xs text-foreground-muted"
          >
            Seu perfil atual possui acesso somente de leitura às configurações da loja.
          </div>
        )}

        {feedback && (
          <div
            role="status"
            className={`p-3.5 mb-6 rounded-xl text-xs flex items-center justify-between border ${
              feedback.error
                ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
              className="font-bold text-xs px-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Seção 1: Operação da Loja, Moeda e Estoque */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Store className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Operação Comercial & Estoque</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="storeName" className="block text-xs font-semibold text-foreground mb-1.5">
                  Nome Comercial da Loja *
                </label>
                <input
                  id="storeName"
                  name="storeName"
                  type="text"
                  required
                  disabled={!canWrite || loading}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-xs font-semibold text-foreground mb-1.5">
                  Moeda Padrão *
                </label>
                <select
                  id="currency"
                  name="currency"
                  disabled={!canWrite || loading}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                >
                  <option value="BRL">BRL — Real Brasileiro (R$)</option>
                  <option value="USD">USD — Dólar Americano ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                </select>
              </div>

              <div>
                <label htmlFor="inventoryMode" className="block text-xs font-semibold text-foreground mb-1.5">
                  Modo de Controle de Estoque
                </label>
                <select
                  id="inventoryMode"
                  name="inventoryMode"
                  disabled={!canWrite || loading}
                  value={inventoryMode}
                  onChange={(e) =>
                    setInventoryMode(e.target.value as "track_quantity" | "untracked")
                  }
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                >
                  <option value="track_quantity">Controlar quantidade por variante</option>
                  <option value="untracked">Estoque livre / Não rastreado</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canWrite || loading}
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-0.5 rounded border-surface-border accent-accent"
                />
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Catálogo & Vitrine Comercial Ativados
                  </span>
                  <span className="text-xs text-foreground-muted block mt-0.5">
                    Quando desativado, o catálogo e a loja pública ficam temporariamente indisponíveis para visitantes.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Seção 2: Canais de Atendimento e Redes Sociais */}
          <div className="space-y-4 pt-6 border-t border-surface-border">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <PhoneCall className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Atendimento Comercial & Canais</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactEmail" className="block text-xs font-semibold text-foreground mb-1.5">
                  E-mail de Atendimento
                </label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  disabled={!canWrite || loading}
                  placeholder="atendimento@minhaloja.com.br"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="contactPhone" className="block text-xs font-semibold text-foreground mb-1.5">
                  Telefone / WhatsApp Comercial
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  type="text"
                  disabled={!canWrite || loading}
                  placeholder="(11) 99999-9999"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="social_instagram" className="block text-xs font-semibold text-foreground mb-1.5">
                  Instagram
                </label>
                <input
                  id="social_instagram"
                  name="social_instagram"
                  type="text"
                  disabled={!canWrite || loading}
                  placeholder="https://instagram.com/..."
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-background border border-surface-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="social_tiktok" className="block text-xs font-semibold text-foreground mb-1.5">
                  TikTok
                </label>
                <input
                  id="social_tiktok"
                  name="social_tiktok"
                  type="text"
                  disabled={!canWrite || loading}
                  placeholder="https://tiktok.com/@..."
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-background border border-surface-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="social_youtube" className="block text-xs font-semibold text-foreground mb-1.5">
                  YouTube
                </label>
                <input
                  id="social_youtube"
                  name="social_youtube"
                  type="text"
                  disabled={!canWrite || loading}
                  placeholder="https://youtube.com/@..."
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-background border border-surface-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end pt-4 border-t border-surface-border">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{loading ? "Salvando..." : "Salvar Configurações Operacionais"}</span>
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
