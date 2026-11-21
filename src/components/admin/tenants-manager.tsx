"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, Building2, Activity, Palette } from "lucide-react";
import {
  updateTenantStatusAction,
  type TenantActionState,
} from "@/app/actions/tenant.actions";
import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { TenantStatus } from "@/types/database.types";

interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  created_at: string;
  ownerName: string;
}

interface TenantsManagerProps {
  tenants: TenantListItem[];
}

export function TenantsManager({ tenants }: TenantsManagerProps) {
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<TenantActionState | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "suspended"
  >("all");
  const [pendingAction, setPendingAction] = React.useState<{
    tenantId: string;
    tenantName: string;
    newStatus: TenantStatus;
  } | null>(null);

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;

  const filteredTenants = React.useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.ownerName.toLowerCase().includes(q)
      );
    });
  }, [tenants, statusFilter, searchQuery]);

  const executeStatusChange = () => {
    if (!pendingAction) return;
    const { tenantId, newStatus } = pendingAction;
    setFeedback(null);
    startTransition(async () => {
      const result = await updateTenantStatusAction(tenantId, newStatus);
      setFeedback(result);
      setPendingAction(null);
    });
  };

  const tabs: Array<{
    key: "all" | "active" | "suspended";
    label: string;
    count: number;
  }> = [
    { key: "all", label: "Todos", count: tenants.length },
    { key: "active", label: "Ativos", count: activeCount },
    { key: "suspended", label: "Suspensos", count: suspendedCount },
  ];

  return (
    <div className="space-y-5">
      {feedback && (
        <AlertBanner
          variant={feedback.success ? "success" : "error"}
          title={feedback.success ? "Operação concluída" : "Erro na operação"}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message || feedback.error}
        </AlertBanner>
      )}

      {/* Painel Unificado Retail OS: Filtros + Busca + Tabela sem dupla borda */}
      <div className="rounded-xl border border-surface-border bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar empresas por status"
            className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-surface-muted border border-surface-border self-start"
          >
            {tabs.map((tab) => {
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#10131C] text-white dark:bg-accent dark:text-white"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums px-1.5 py-0.2 rounded ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-surface text-foreground-muted"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nome, slug ou proprietário..."
            ariaLabel="Buscar estabelecimentos"
            className="w-full sm:w-80"
          />
        </div>

        {filteredTenants.length === 0 ? (
          <EmptyState
            embedded
            icon={<Building2 className="w-6 h-6" />}
            title="Nenhum estabelecimento encontrado"
            description="Ajuste os filtros de busca ou cadastre uma nova empresa na plataforma."
          />
        ) : (
          <DataTable embedded ariaLabel="Tabela de gerenciamento de empresas">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted/40 text-foreground-muted text-[11px] uppercase tracking-[0.08em]">
                <th className="py-3 px-5 font-semibold">Nome</th>
                <th className="py-3 px-4 font-semibold">Slug</th>
                <th className="py-3 px-4 font-semibold">Proprietário Inicial</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Cadastrado em</th>
                <th className="py-3 px-5 font-semibold text-right">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-xs">
              {filteredTenants.map((tenant) => {
                const isActive = tenant.status === "active";
                return (
                  <tr
                    key={tenant.id}
                    className="hover:bg-surface-muted/40 transition-colors"
                  >
                    <td
                      data-label="Nome"
                      className="py-3.5 px-5 font-semibold text-foreground"
                    >
                      {tenant.name}
                    </td>
                    <td
                      data-label="Slug"
                      className="py-3.5 px-4 font-mono text-xs text-foreground-muted"
                    >
                      {tenant.slug}
                    </td>
                    <td
                      data-label="Proprietário"
                      className="py-3.5 px-4 text-foreground"
                    >
                      {tenant.ownerName}
                    </td>
                    <td data-label="Status" className="py-3.5 px-4">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td
                      data-label="Cadastrado em"
                      className="py-3.5 px-4 font-mono text-foreground-muted tabular-nums"
                    >
                      {new Date(tenant.created_at).toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td data-label="Ações" className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/sites?tenantId=${tenant.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Palette className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                          <span>Site</span>
                        </Link>
                        <Link
                          href={`/admin/atividades?tenantId=${tenant.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Activity className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                          <span>Auditoria</span>
                        </Link>
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                tenantId: tenant.id,
                                tenantName: tenant.name,
                                newStatus: "suspended",
                              })
                            }
                            disabled={isPending}
                            className="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 hover:bg-red-500/20 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Suspender
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                tenantId: tenant.id,
                                tenantName: tenant.name,
                                newStatus: "active",
                              })
                            }
                            disabled={isPending}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Reativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={executeStatusChange}
        isLoading={isPending}
        variant={pendingAction?.newStatus === "suspended" ? "danger" : "primary"}
        title={
          pendingAction?.newStatus === "suspended"
            ? "Suspender Estabelecimento"
            : "Reativar Estabelecimento"
        }
        description={
          pendingAction?.newStatus === "suspended"
            ? `Tem certeza de que deseja suspender "${pendingAction?.tenantName}"? Todos os membros perderão imediatamente o acesso operacional via RLS.`
            : `Deseja restaurar o status ativo de "${pendingAction?.tenantName}" e liberar o acesso operacional aos seus membros?`
        }
        confirmLabel={
          pendingAction?.newStatus === "suspended"
            ? "Confirmar Suspensão"
            : "Confirmar Reativação"
        }
      />
    </div>
  );
}
