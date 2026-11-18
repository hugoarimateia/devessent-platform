"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { switchTenantAction } from "@/app/actions/tenant.actions";
import { resolveTenantBrand, ROLE_DISPLAY_MAP } from "@/lib/theme/tenant-brand";
import type { UserTenantSummary } from "@/core/tenants";

interface QuickTenantSwitcherProps {
  tenants: UserTenantSummary[];
  activeTenantId: string;
}

export function QuickTenantSwitcher({
  tenants,
  activeTenantId,
}: QuickTenantSwitcherProps) {
  const [isPending, startTransition] = React.useTransition();
  const [switchingTo, setSwitchingTo] = React.useState<string | null>(null);

  const handleSwitch = (tenantId: string) => {
    if (tenantId === activeTenantId || isPending) return;
    setSwitchingTo(tenantId);
    startTransition(async () => {
      await switchTenantAction(tenantId);
    });
  };

  return (
    <section
      aria-label="Unidades vinculadas"
      className="rounded-xl border border-surface-border bg-surface overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
            Unidades Vinculadas
          </h3>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            {tenants.length > 1
              ? "Alterne o contexto operacional da sessão"
              : "Estabelecimento associado ao seu perfil"}
          </p>
        </div>
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted text-foreground-muted tabular-nums">
          {tenants.length}
        </span>
      </div>

      <div className="divide-y divide-surface-border">
        {tenants.map((t) => {
          const isCurrent = t.tenantId === activeTenantId;
          const tBrand = resolveTenantBrand({
            slug: t.slug,
            name: t.name,
            displayName: t.displayName,
            segmentLabel: t.segmentLabel,
            primaryColor: t.primaryColor,
            monogram: t.monogram,
            brandDescription: t.brandDescription,
          });
          const roleLabel = ROLE_DISPLAY_MAP[t.role]?.shortLabel || t.role;
          const isSwitchingThis = switchingTo === t.tenantId && isPending;

          return (
            <div
              key={t.tenantId}
              className={`px-5 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                isCurrent ? "bg-surface-muted/55" : "hover:bg-surface-muted/35"
              }`}
              style={
                isCurrent
                  ? {
                      borderLeft: `3px solid ${tBrand.fillLight}`,
                      paddingLeft: "17px",
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: tBrand.fillLight }}
                >
                  {tBrand.monogram}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {t.name}
                  </p>
                  <p className="text-[11px] text-foreground-muted truncate">
                    {roleLabel} · {tBrand.segmentTag}
                  </p>
                </div>
              </div>

              {isCurrent ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold shrink-0">
                  <Check className="w-3 h-3" aria-hidden="true" />
                  Ativo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitch(t.tenantId)}
                  disabled={isPending}
                  className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs font-semibold text-foreground transition-colors shrink-0 cursor-pointer"
                >
                  {isSwitchingThis ? "Trocando..." : "Acessar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
