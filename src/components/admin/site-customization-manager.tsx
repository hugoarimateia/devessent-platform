"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Layout,
  Save,
  Eye,
  ExternalLink,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import type { AdminRetailStoreOverview } from "@/modules/retail/services/retail-store-service";
import type { StorefrontTemplate } from "@/modules/retail/types/retail.types";
import { updateStorefrontDesignAction } from "@/modules/retail/actions/retail-store.actions";

interface SiteCustomizationManagerProps {
  stores: AdminRetailStoreOverview[];
  initialTenantId?: string;
}

/**
 * Área Técnica Exclusiva da Equipe DevEssent (`platform_admin`).
 * Permite ajustar template, paleta, hero e estrutura da vitrine de cada empresa cliente,
 * além de pré-visualizar direções visuais sem expor esses controles ao painel operacional do cliente.
 */
export function SiteCustomizationManager({
  stores,
  initialTenantId,
}: SiteCustomizationManagerProps) {
  const router = useRouter();
  const [selectedTenantId, setSelectedTenantId] = React.useState<string>(
    stores.find((s) => s.tenantId === initialTenantId)?.tenantId || stores[0]?.tenantId || ""
  );

  const selectedStore = React.useMemo(
    () => stores.find((s) => s.tenantId === selectedTenantId) || stores[0] || null,
    [stores, selectedTenantId]
  );

  const [template, setTemplate] = React.useState<StorefrontTemplate>(
    selectedStore?.template || "editorial"
  );
  const [heroBadge, setHeroBadge] = React.useState(selectedStore?.heroBadge || "");
  const [brandHeadline, setBrandHeadline] = React.useState(selectedStore?.brandHeadline || "");
  const [brandSubheadline, setBrandSubheadline] = React.useState(
    selectedStore?.brandSubheadline || ""
  );
  const [aboutText, setAboutText] = React.useState(selectedStore?.aboutText || "");
  const [announcementBar, setAnnouncementBar] = React.useState(
    selectedStore?.announcementBar || ""
  );
  const [accentColor, setAccentColor] = React.useState(
    selectedStore?.accentColor || "#111111"
  );
  const [secondaryColor, setSecondaryColor] = React.useState(
    selectedStore?.secondaryColor || "#f4f3f0"
  );

  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);

  React.useEffect(() => {
    if (!selectedStore) return;
    setTemplate(selectedStore.template || "editorial");
    setHeroBadge(selectedStore.heroBadge || "");
    setBrandHeadline(selectedStore.brandHeadline || "");
    setBrandSubheadline(selectedStore.brandSubheadline || "");
    setAboutText(selectedStore.aboutText || "");
    setAnnouncementBar(selectedStore.announcementBar || "");
    setAccentColor(selectedStore.accentColor || "#111111");
    setSecondaryColor(selectedStore.secondaryColor || "#f4f3f0");
    setFeedback(null);
  }, [selectedStore]);

  if (!selectedStore) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface p-10 text-center space-y-2">
        <Palette className="w-8 h-8 mx-auto text-foreground-muted/40" aria-hidden="true" />
        <h2 className="font-display text-base font-bold text-foreground">
          Nenhuma vitrine Retail provisionada
        </h2>
        <p className="text-xs text-foreground-muted max-w-md mx-auto">
          Assim que uma empresa possuir o módulo Retail inicializado, ela aparecerá aqui para customização visual pela equipe DevEssent.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("template", template);
    formData.append("heroBadge", heroBadge);
    formData.append("brandHeadline", brandHeadline);
    formData.append("brandSubheadline", brandSubheadline);
    formData.append("aboutText", aboutText);
    formData.append("announcementBar", announcementBar);
    formData.append("accentColor", accentColor);
    formData.append("secondaryColor", secondaryColor);

    const res = await updateStorefrontDesignAction(selectedStore.tenantId, null, formData);
    setLoading(false);

    if (!res.success) {
      setFeedback({ text: res.error || "Erro ao salvar arquitetura visual.", error: true });
    } else {
      setFeedback({
        text: `Arquitetura visual da loja '${selectedStore.storeName}' atualizada com sucesso.`,
      });
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Empresa Cliente + Links Técnicos de Preview */}
      <section className="rounded-2xl border border-surface-border bg-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[var(--shadow-card)]">
        <div className="space-y-2 flex-1 max-w-md">
          <label
            htmlFor="admin-store-selector"
            className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
          >
            Empresa Cliente Selecionada
          </label>
          <select
            id="admin-store-selector"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-surface-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {stores.map((s) => (
              <option key={s.tenantId} value={s.tenantId}>
                {s.tenantName} — /loja/{s.slug} ({s.template})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`/loja/${selectedStore.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Vitrine Publicada</span>
          </a>
          <a
            href={`/loja/${selectedStore.slug}?preview_template=editorial`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border border-surface-border bg-surface-muted/50 hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Preview Editorial</span>
          </a>
          <a
            href={`/loja/${selectedStore.slug}?preview_template=experimental`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border border-surface-border bg-surface-muted/50 hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>Preview Experimental</span>
          </a>
        </div>
      </section>

      {/* Formulário Técnico Restrito */}
      <section className="rounded-2xl border border-surface-border bg-surface p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Arquitetura Visual & Template — {selectedStore.storeName}
              </h2>
              <p className="text-xs text-foreground-muted">
                Alterações persistidas diretamente na vitrine pública do cliente selecionado
              </p>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/25 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Exclusivo DevEssent
          </span>
        </div>

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
              className="font-bold text-xs px-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Seleção de Template */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Layout className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Template Estrutural Contratado</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setTemplate("editorial")}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  template === "editorial"
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-surface-border bg-background hover:border-foreground/35"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
                    Direção A — Editorial
                  </span>
                  <input
                    type="radio"
                    name="template"
                    value="editorial"
                    checked={template === "editorial"}
                    onChange={() => setTemplate("editorial")}
                    className="accent-accent"
                  />
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Tipografia editorial de alto respiro, paleta off-white e destaque para fotografia autoral.
                </p>
              </div>

              <div
                onClick={() => setTemplate("experimental")}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  template === "experimental"
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-surface-border bg-background hover:border-foreground/35"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-display uppercase tracking-wider text-foreground">
                    Direção B — Experimental
                  </span>
                  <input
                    type="radio"
                    name="template"
                    value="experimental"
                    checked={template === "experimental"}
                    onChange={() => setTemplate("experimental")}
                    className="accent-accent"
                  />
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Composição gráfica dark em alto contraste, acentos neon e layout streetwear modular.
                </p>
              </div>
            </div>
          </div>

          {/* Hero & Textos Estruturais */}
          <div className="space-y-4 pt-6 border-t border-surface-border">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Megaphone className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Hero Institucional, Paleta & Estrutura</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Badge do Hero (Temporada / Linha)
                </label>
                <input
                  type="text"
                  value={heroBadge}
                  onChange={(e) => setHeroBadge(e.target.value)}
                  placeholder="Ex: NEW SEASON — SPRING 2026"
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Barra de Anúncios do Topo
                </label>
                <input
                  type="text"
                  value={announcementBar}
                  onChange={(e) => setAnnouncementBar(e.target.value)}
                  placeholder="Ex: FRETE GRÁTIS ACIMA DE R$ 250"
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Headline Principal (Hero)
                </label>
                <input
                  type="text"
                  value={brandHeadline}
                  onChange={(e) => setBrandHeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Subtítulo / Manifesto Curto
                </label>
                <input
                  type="text"
                  value={brandSubheadline}
                  onChange={(e) => setBrandSubheadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Texto Institucional / Sobre a Marca
              </label>
              <textarea
                rows={3}
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Cor de Destaque da Vitrine (#RRGGBB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : "#111111"}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-surface-border p-1 bg-background cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Cor Secundária de Superfície (#RRGGBB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(secondaryColor) ? secondaryColor : "#f4f3f0"}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-surface-border p-1 bg-background cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-background border border-surface-border text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface-border">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-secondary text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{loading ? "Aplicando..." : "Salvar Arquitetura Visual"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
