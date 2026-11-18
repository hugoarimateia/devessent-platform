"use client";

import * as React from "react";
import { Store, CheckCircle, ShieldAlert } from "lucide-react";
import { updateRetailStoreAction } from "../actions/retail-store.actions";

interface RetailModuleInactiveProps {
  tenantId: string;
  tenantName: string;
  userRole: string;
}

export function RetailModuleInactive({
  tenantId,
  tenantName,
  userRole,
}: RetailModuleInactiveProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canManage = userRole === "owner" || userRole === "manager" || userRole === "platform_admin";

  const handleActivate = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("storeName", `Loja ${tenantName}`);
    formData.append("currency", "BRL");
    formData.append("isActive", "true");
    formData.append("inventoryMode", "track_quantity");

    const result = await updateRetailStoreAction(tenantId, null, formData);
    if (!result.success) {
      setError(result.error || "Não foi possível ativar o módulo Retail.");
      setLoading(false);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center bg-surface border border-border rounded-[16px] max-w-2xl mx-auto shadow-sm">
      <div
        className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-6"
        style={{
          backgroundColor: "var(--t-tint, rgba(91, 70, 229, 0.08))",
          color: "var(--t-ink, var(--accent))",
        }}
      >
        <Store className="w-8 h-8" />
      </div>

      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-foreground-muted mb-2">
        Módulo Vertical Não Ativado
      </span>

      <h2 className="text-2xl font-bold font-display text-foreground tracking-tight mb-3">
        DevEssent Retail Desativado
      </h2>

      <p className="text-sm text-foreground-muted max-w-md mb-6 leading-relaxed">
        O catálogo comercial, gestão de produtos e motor de vendas do Retail não estão habilitados para o estabelecimento{" "}
        <strong className="text-foreground font-semibold">{tenantName}</strong>.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-[10px] flex items-center gap-2 text-left w-full"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {canManage ? (
        <div className="space-y-3">
          <button
            onClick={handleActivate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
            style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
          >
            {loading ? (
              <span>Ativando módulo...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Ativar DevEssent Retail nesta Empresa</span>
              </>
            )}
          </button>
          <p className="text-xs text-foreground-muted">
            Disponível para Proprietários e Gestores do estabelecimento.
          </p>
        </div>
      ) : (
        <p className="text-xs text-foreground-muted italic">
          Entre em contato com um administrador ou proprietário da sua empresa para habilitar o módulo de catálogo.
        </p>
      )}
    </div>
  );
}

