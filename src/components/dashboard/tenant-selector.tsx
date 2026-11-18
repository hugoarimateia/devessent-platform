"use client";

import * as React from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { switchTenantAction } from "@/app/actions/tenant.actions";
import { resolveTenantBrand, ROLE_DISPLAY_MAP } from "@/lib/theme/tenant-brand";
import type { UserTenantSummary } from "@/core/tenants";

interface TenantSelectorProps {
  tenants: UserTenantSummary[];
  activeTenantId: string;
  activeRole: string;
}

export function TenantSelector({
  tenants,
  activeTenantId,
  activeRole,
}: TenantSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const activeTenant =
    tenants.find((t) => t.tenantId === activeTenantId) || tenants[0];

  const handleSelect = (tenantId: string) => {
    if (tenantId === activeTenantId || isPending) return;
    setIsOpen(false);
    startTransition(async () => {
      await switchTenantAction(tenantId);
    });
  };

  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!activeTenant) return null;

  const activeBrand = resolveTenantBrand({
    slug: activeTenant.slug,
    name: activeTenant.name,
    displayName: activeTenant.displayName,
    segmentLabel: activeTenant.segmentLabel,
    primaryColor: activeTenant.primaryColor,
    monogram: activeTenant.monogram,
    brandDescription: activeTenant.brandDescription,
  });

  const roleInfo = ROLE_DISPLAY_MAP[activeRole] || {
    label: activeRole,
    shortLabel: activeRole,
  };

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending || tenants.length <= 1}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted/80 text-xs transition-colors text-left max-w-full ${
          tenants.length > 1 ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={tenants.length > 1 ? isOpen : undefined}
        aria-haspopup={tenants.length > 1 ? "listbox" : undefined}
        aria-label="Selecionar estabelecimento ativo"
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0 text-white"
          style={{
            backgroundColor: "var(--t-fill, #5B46E5)",
          }}
        >
          {activeBrand.monogram || <Building2 className="w-3 h-3" />}
        </div>

        <div className="min-w-0 flex items-center gap-2 pr-0.5">
          <span className="font-semibold text-[13px] text-foreground truncate max-w-[110px] sm:max-w-[200px]">
            {activeTenant.name}
          </span>
          <span className="hidden sm:inline text-[11px] text-foreground-muted">
            / {roleInfo.shortLabel}
          </span>
          {tenants.length > 1 && (
            <span className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-foreground-muted tabular-nums">
              {tenants.length}
            </span>
          )}
          {activeTenant.status === "suspended" && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
              • Suspenso
            </span>
          )}
        </div>

        {tenants.length > 1 && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-foreground-muted transition-transform shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && tenants.length > 1 && (
        <div
          role="listbox"
          aria-label="Estabelecimentos vinculados"
          className="absolute left-0 mt-1.5 w-76 rounded-xl border border-surface-border bg-surface shadow-elevated p-1.5 z-50 space-y-0.5"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-foreground-muted flex items-center justify-between border-b border-surface-border mb-1">
            <span>Estabelecimentos</span>
            <span className="tabular-nums">{tenants.length} unidades</span>
          </div>
          {tenants.map((tenant) => {
            const isSelected = tenant.tenantId === activeTenantId;
            const brand = resolveTenantBrand({
              slug: tenant.slug,
              name: tenant.name,
              displayName: tenant.displayName,
              segmentLabel: tenant.segmentLabel,
              primaryColor: tenant.primaryColor,
              monogram: tenant.monogram,
              brandDescription: tenant.brandDescription,
            });
            const tRole = ROLE_DISPLAY_MAP[tenant.role]?.shortLabel || tenant.role;

            return (
              <button
                key={tenant.tenantId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(tenant.tenantId)}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? "bg-surface-muted font-semibold text-foreground"
                    : "hover:bg-surface-muted/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: brand.fillLight }}
                  >
                    {brand.monogram}
                  </div>
                  <div className="truncate pr-1">
                    <p className="font-semibold text-foreground truncate">
                      {tenant.name}
                    </p>
                    <p className="text-[10px] text-foreground-muted truncate">
                      {tRole} · {brand.segmentTag}
                      {tenant.status === "suspended" && " · Suspenso"}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Check
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: "var(--t-ink, #5B46E5)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
