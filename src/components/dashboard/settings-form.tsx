"use client";

import * as React from "react";
import { Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertBanner } from "@/components/ui/alert-banner";
import {
  resolveTenantBrand,
  BRAND_COLOR_SWATCHES,
} from "@/lib/theme/tenant-brand";
import {
  updateTenantSettingsAction,
  type TenantActionState,
} from "@/app/actions/tenant.actions";
import type { TenantSettings } from "@/types/database.types";

interface SettingsFormProps {
  tenantId: string;
  tenantSlug?: string;
  tenantName?: string;
  initialSettings: TenantSettings;
  canEdit: boolean;
}

export function SettingsForm({
  tenantId,
  tenantSlug,
  tenantName,
  initialSettings,
  canEdit,
}: SettingsFormProps) {
  const [displayName, setDisplayName] = React.useState(
    initialSettings.display_name
  );
  const [contactEmail, setContactEmail] = React.useState(
    initialSettings.contact_email || ""
  );
  const [contactPhone, setContactPhone] = React.useState(
    initialSettings.contact_phone || ""
  );
  const [segmentLabel, setSegmentLabel] = React.useState(
    initialSettings.segment_label || "Operação Comercial"
  );
  const [primaryColor, setPrimaryColor] = React.useState(
    initialSettings.primary_color || "#5B46E5"
  );
  const [monogram, setMonogram] = React.useState(
    initialSettings.monogram || ""
  );
  const [brandDescription, setBrandDescription] = React.useState(
    initialSettings.brand_description || ""
  );
  const [timezone, setTimezone] = React.useState(initialSettings.timezone);
  const [locale, setLocale] = React.useState(initialSettings.locale);
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<TenantActionState | null>(
    null
  );

  const brand = resolveTenantBrand({
    slug: tenantSlug,
    name: tenantName,
    displayName,
    segmentLabel,
    primaryColor,
    monogram,
    brandDescription,
  });

  const fieldError = (name: string): string | undefined =>
    feedback?.fieldErrors?.[name]?.[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit || isPending) return;

    const formEl = e.currentTarget;
    setFeedback(null);
    const formData = new FormData();
    formData.append("display_name", displayName);
    formData.append("contact_email", contactEmail);
    formData.append("contact_phone", contactPhone);
    formData.append("segment_label", segmentLabel);
    formData.append("primary_color", primaryColor);
    formData.append("monogram", monogram.trim().toUpperCase());
    formData.append("brand_description", brandDescription);
    formData.append("timezone", timezone);
    formData.append("locale", locale);

    startTransition(async () => {
      const result = await updateTenantSettingsAction(tenantId, null, formData);
      setFeedback(result);
      if (result.fieldErrors) {
        const firstInvalidKey = Object.keys(result.fieldErrors)[0];
        if (firstInvalidKey) {
          const targetEl = formEl.querySelector<HTMLElement>(
            `[name="${firstInvalidKey}"], #${firstInvalidKey}`
          );
          targetEl?.focus();
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {feedback && (
        <AlertBanner
          variant={feedback.success ? "success" : "error"}
          title={feedback.success ? "Sucesso" : "Falha na validação"}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message || feedback.error}
        </AlertBanner>
      )}

      {!canEdit && (
        <div className="p-4 rounded-xl border border-surface-border bg-surface-muted/60 text-xs sm:text-sm text-foreground-muted flex items-center gap-2.5">
          <Settings className="w-4 h-4 text-accent shrink-0" />
          Você possui acesso somente de leitura às configurações deste estabelecimento.
        </div>
      )}

      {/* Pré-visualização Editorial Dinâmica */}
      <section
        aria-label="Pré-visualização da identidade"
        className="rounded-xl border border-surface-border bg-surface overflow-hidden"
      >
        <div className="h-[4px] w-full" style={{ backgroundColor: brand.fillLight }} />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-[10px] flex items-center justify-center font-mono text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: brand.fillLight }}
            >
              {brand.monogram}
            </div>
            <div className="space-y-1 min-w-0">
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: brand.accentLight }}
              >
                Pré-visualização em Tempo Real · {brand.segmentTag}
              </p>
              <p className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                {displayName || tenantName || "Estabelecimento"}
              </p>
              <p className="text-xs text-foreground-muted leading-relaxed max-w-[60ch]">
                {brand.description}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-muted/60 font-mono text-xs text-foreground self-start sm:self-center shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: brand.primaryHex }}
            />
            <span>{brand.primaryHex}</span>
          </div>
        </div>
      </section>

      {/* Grade Editorial em 3 Seções Contínuas */}
      <div className="rounded-xl border border-surface-border bg-surface overflow-hidden divide-y divide-surface-border">
        {/* Seção 01: Dados Cadastrais */}
        <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              01 · Identificação
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Dados Cadastrais
            </h2>
            <p className="text-xs text-foreground-muted leading-relaxed">
              Nome público exibido aos membros e canais oficiais de contato comercial.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div>
              <Label htmlFor="display_name" required>
                Nome de Exibição (Fantasia)
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                aria-invalid={fieldError("display_name") ? "true" : "false"}
                aria-describedby={fieldError("display_name") ? "error-display_name" : undefined}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!canEdit || isPending}
                placeholder="Ex: Verde Sustentabilidade"
              />
              {fieldError("display_name") && (
                <p id="error-display_name" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldError("display_name")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_email">E-mail de Contato Comercial</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={fieldError("contact_email") ? "true" : "false"}
                  aria-describedby={fieldError("contact_email") ? "error-contact_email" : undefined}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!canEdit || isPending}
                  placeholder="contato@empresa.com.br"
                />
                {fieldError("contact_email") && (
                  <p id="error-contact_email" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldError("contact_email")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="contact_phone">Telefone / WhatsApp</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  aria-invalid={fieldError("contact_phone") ? "true" : "false"}
                  aria-describedby={fieldError("contact_phone") ? "error-contact_phone" : undefined}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={!canEdit || isPending}
                  placeholder="(11) 98888-1001"
                />
                {fieldError("contact_phone") && (
                  <p id="error-contact_phone" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldError("contact_phone")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seção 02: Identidade Visual */}
        <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              02 · Marca
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Identidade Visual da Unidade
            </h2>
            <p className="text-xs text-foreground-muted leading-relaxed">
              Segmento, monograma e cor de destaque próprios desta empresa aplicados ao ambiente.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="segment_label" required>
                  Segmento de Atuação
                </Label>
                <Input
                  id="segment_label"
                  name="segment_label"
                  required
                  aria-invalid={fieldError("segment_label") ? "true" : "false"}
                  aria-describedby={fieldError("segment_label") ? "error-segment_label" : undefined}
                  value={segmentLabel}
                  onChange={(e) => setSegmentLabel(e.target.value)}
                  disabled={!canEdit || isPending}
                  placeholder="Ex: Botânica & Paisagismo"
                />
                {fieldError("segment_label") && (
                  <p id="error-segment_label" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldError("segment_label")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="monogram">Monograma (1–3 letras)</Label>
                <Input
                  id="monogram"
                  name="monogram"
                  maxLength={3}
                  aria-invalid={fieldError("monogram") ? "true" : "false"}
                  aria-describedby={fieldError("monogram") ? "error-monogram" : undefined}
                  value={monogram}
                  onChange={(e) => setMonogram(e.target.value.toUpperCase())}
                  disabled={!canEdit || isPending}
                  placeholder={brand.monogram}
                  className="font-mono uppercase"
                />
                {fieldError("monogram") && (
                  <p id="error-monogram" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {fieldError("monogram")}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="primary_color">Cor Institucional (#RRGGBB)</Label>
              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                {BRAND_COLOR_SWATCHES.map((swatch) => {
                  const isSelected =
                    primaryColor.toUpperCase() === swatch.hex.toUpperCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      disabled={!canEdit || isPending}
                      onClick={() => setPrimaryColor(swatch.hex)}
                      title={swatch.label}
                      aria-label={`Selecionar cor ${swatch.label}`}
                      className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                        isSelected
                          ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface"
                          : "border-surface-border hover:scale-105"
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  );
                })}
                <Input
                  id="primary_color"
                  name="primary_color"
                  aria-invalid={fieldError("primary_color") ? "true" : "false"}
                  aria-describedby={fieldError("primary_color") ? "error-primary_color" : undefined}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!canEdit || isPending}
                  className="w-28 font-mono text-xs min-h-[36px]"
                  placeholder="#5B46E5"
                />
              </div>
              {fieldError("primary_color") && (
                <p id="error-primary_color" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldError("primary_color")}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="brand_description">
                Resumo Operacional da Empresa
              </Label>
              <Textarea
                id="brand_description"
                name="brand_description"
                rows={2}
                aria-invalid={fieldError("brand_description") ? "true" : "false"}
                aria-describedby={fieldError("brand_description") ? "error-brand_description" : undefined}
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                disabled={!canEdit || isPending}
                placeholder="Descreva brevemente o foco comercial desta unidade..."
              />
              {fieldError("brand_description") && (
                <p id="error-brand_description" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {fieldError("brand_description")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 03: Preferências Regionais */}
        <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              03 · Regionalidade
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Preferências Regionais
            </h2>
            <p className="text-xs text-foreground-muted leading-relaxed">
              Fuso horário de referência e localização padrão de datas e textos.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone" required>
                Fuso Horário
              </Label>
              <Select
                id="timezone"
                name="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canEdit || isPending}
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="America/Manaus">Manaus (GMT-4)</option>
                <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="locale" required>
                Idioma · Região
              </Label>
              <Select
                id="locale"
                name="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                disabled={!canEdit || isPending}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </Select>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="px-6 py-4 bg-surface-muted/40 flex justify-end">
            <Button type="submit" isLoading={isPending}>
              <Save className="w-4 h-4" />
              <span>Salvar Configurações</span>
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
