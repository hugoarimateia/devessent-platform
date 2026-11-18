"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AuditLogViewItem,
  AuditPeriodFilter,
} from "@/core/audit";

interface TenantFilterOption {
  id: string;
  name: string;
  slug: string;
}

interface ActionFilterOption {
  value: string;
  label: string;
}

interface AuditLogViewerProps {
  mode: "platform" | "tenant";
  items: AuditLogViewItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  actionOptions: ActionFilterOption[];
  tenantOptions?: TenantFilterOption[];
  initialFilters: {
    tenantId?: string;
    action?: string;
    period?: AuditPeriodFilter;
    from?: string;
    to?: string;
    search?: string;
  };
}

const TONE_BADGE_CLASS: Record<AuditLogViewItem["actionTone"], string> = {
  neutral:
    "bg-surface-muted text-foreground-muted border-surface-border",
  info:
    "bg-accent/10 text-accent border-accent/20",
  success:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  danger:
    "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
};

function formatDateTimePtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AuditLogViewer({
  mode,
  items,
  totalCount,
  page,
  totalPages,
  actionOptions,
  tenantOptions = [],
  initialFilters,
}: AuditLogViewerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = React.useTransition();

  const [searchValue, setSearchValue] = React.useState(initialFilters.search ?? "");
  const [selectedAction, setSelectedAction] = React.useState(initialFilters.action ?? "all");
  const [selectedTenantId, setSelectedTenantId] = React.useState(
    initialFilters.tenantId ?? "all"
  );
  const [selectedPeriod, setSelectedPeriod] = React.useState<AuditPeriodFilter>(
    initialFilters.period ?? "30d"
  );
  const [fromDate, setFromDate] = React.useState(initialFilters.from ?? "");
  const [toDate, setToDate] = React.useState(initialFilters.to ?? "");
  const [showCustomDates, setShowCustomDates] = React.useState(
    Boolean(initialFilters.from || initialFilters.to)
  );

  const [inspectedItem, setInspectedItem] = React.useState<AuditLogViewItem | null>(null);
  const detailDialogRef = React.useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = React.useRef(false);
  const detailTitleId = React.useId();

  React.useEffect(() => {
    setSearchValue(initialFilters.search ?? "");
    setSelectedAction(initialFilters.action ?? "all");
    setSelectedTenantId(initialFilters.tenantId ?? "all");
    setSelectedPeriod(initialFilters.period ?? "30d");
    setFromDate(initialFilters.from ?? "");
    setToDate(initialFilters.to ?? "");
    setShowCustomDates(Boolean(initialFilters.from || initialFilters.to));
  }, [initialFilters]);

  React.useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;

    if (inspectedItem && !dialog.open) {
      dialog.showModal();
    } else if (!inspectedItem && dialog.open) {
      dialog.close();
      dialog.returnValue = "";
    }
  }, [inspectedItem]);

  const navigateWithFilters = (overrides: {
    search?: string;
    action?: string;
    tenantId?: string;
    period?: AuditPeriodFilter;
    from?: string;
    to?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const nextSearch = (overrides.search ?? searchValue).trim();
    const nextAction = overrides.action ?? selectedAction;
    const nextTenant = overrides.tenantId ?? selectedTenantId;
    const nextPeriod = overrides.period ?? selectedPeriod;
    const nextFrom = overrides.from !== undefined ? overrides.from : fromDate;
    const nextTo = overrides.to !== undefined ? overrides.to : toDate;
    const nextPage = overrides.page ?? 1;

    if (nextSearch) params.set("search", nextSearch);
    if (nextAction && nextAction !== "all") params.set("action", nextAction);
    if (mode === "platform" && nextTenant && nextTenant !== "all") {
      params.set("tenantId", nextTenant);
    }
    if (nextFrom) {
      params.set("from", nextFrom);
    }
    if (nextTo) {
      params.set("to", nextTo);
    }
    if (!nextFrom && !nextTo && nextPeriod && nextPeriod !== "30d") {
      params.set("period", nextPeriod);
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const handleResetFilters = () => {
    setSearchValue("");
    setSelectedAction("all");
    setSelectedTenantId("all");
    setSelectedPeriod("30d");
    setFromDate("");
    setToDate("");
    setShowCustomDates(false);
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateWithFilters({ search: searchValue, page: 1 });
  };

  const hasActiveFilters = Boolean(
    searchValue.trim() ||
      selectedAction !== "all" ||
      (mode === "platform" && selectedTenantId !== "all") ||
      selectedPeriod !== "30d" ||
      fromDate ||
      toDate
  );

  const isPointerOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = detailDialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  const closeDetailModal = () => {
    const dialog = detailDialogRef.current;
    if (dialog) {
      dialog.returnValue = "";
    }
    setInspectedItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Operacional */}
      <section
        aria-label="Filtros de auditoria"
        className="rounded-xl border border-surface-border bg-surface p-4 space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder={
                mode === "platform"
                  ? "Buscar por empresa, e-mail, autor ou evento..."
                  : "Buscar por evento, autor ou detalhe operacional..."
              }
              className="flex-1"
              aria-label="Buscar eventos de auditoria"
            />
            <Button type="submit" variant="outline" size="sm" disabled={isNavigating}>
              Filtrar
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {mode === "platform" && (
              <Select
                aria-label="Filtrar por estabelecimento"
                value={selectedTenantId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTenantId(val);
                  navigateWithFilters({ tenantId: val, page: 1 });
                }}
                className="w-full sm:w-[210px]"
              >
                <option value="all">Todas as empresas</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
            )}

            <Select
              aria-label="Filtrar por tipo de ação"
              value={selectedAction}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAction(val);
                navigateWithFilters({ action: val, page: 1 });
              }}
              className="w-full sm:w-[220px]"
            >
              <option value="all">Todas as ações</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filtrar por período"
              value={showCustomDates ? "custom" : selectedPeriod}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setShowCustomDates(true);
                  return;
                }
                setShowCustomDates(false);
                setFromDate("");
                setToDate("");
                const period = val as AuditPeriodFilter;
                setSelectedPeriod(period);
                navigateWithFilters({ period, from: "", to: "", page: 1 });
              }}
              className="w-full sm:w-[175px]"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todo o histórico</option>
              <option value="custom">Intervalo específico</option>
            </Select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                disabled={isNavigating}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {showCustomDates && (
          <div className="pt-2 border-t border-surface-border flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="audit-from-date"
                className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Data inicial
              </label>
              <input
                id="audit-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-lg border border-surface-border bg-surface px-3 text-xs text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="audit-to-date"
                className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Data final
              </label>
              <input
                id="audit-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-lg border border-surface-border bg-surface px-3 text-xs text-foreground"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigateWithFilters({ from: fromDate, to: toDate, page: 1 })}
              disabled={isNavigating}
              className="gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Aplicar período
            </Button>
          </div>
        )}
      </section>

      {/* Tabela Embutida */}
      <section className="rounded-xl border border-surface-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold text-foreground">
              Eventos Registrados
            </h2>
            <span className="font-mono text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-surface-muted border border-surface-border text-foreground-muted">
              {totalCount}
            </span>
          </div>

          <span className="font-mono text-[11px] text-foreground-muted tabular-nums">
            Página {page} de {totalPages}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Activity className="w-5 h-5" aria-hidden="true" />}
              title={
                hasActiveFilters
                  ? "Nenhum evento encontrado para estes filtros"
                  : "Nenhuma atividade registrada até o momento"
              }
              description={
                hasActiveFilters
                  ? "Ajuste a busca, período ou ação selecionada para visualizar outros eventos operacionais."
                  : "Alterações de configurações, convites, membros e status aparecerão automaticamente nesta trilha."
              }
              action={
                hasActiveFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                    Redefinir filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <DataTable
            embedded
            ariaLabel={
              mode === "platform"
                ? "Histórico global de auditoria da plataforma"
                : "Histórico de auditoria do estabelecimento"
            }
          >
            <thead>
              <tr className="border-b border-surface-border font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
                <th className="py-2.5 px-4">Evento</th>
                {mode === "platform" && <th className="py-2.5 px-4">Estabelecimento</th>}
                <th className="py-2.5 px-4">Responsável</th>
                <th className="py-2.5 px-4">Resumo</th>
                <th className="py-2.5 px-4">Data / Hora</th>
                <th className="py-2.5 px-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-surface-muted/40 transition-colors"
                >
                  <td data-label="Evento" className="py-3 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                          TONE_BADGE_CLASS[item.actionTone]
                        }`}
                      >
                        {item.actionLabel}
                      </span>
                      <span className="font-mono text-[11px] text-foreground-muted">
                        {item.action}
                      </span>
                    </div>
                  </td>

                  {mode === "platform" && (
                    <td data-label="Estabelecimento" className="py-3 px-4 align-top">
                      {item.tenantName ? (
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {item.tenantName}
                          </p>
                          <p className="font-mono text-[11px] text-foreground-muted">
                            /{item.tenantSlug}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-foreground-muted">Plataforma</span>
                      )}
                    </td>
                  )}

                  <td data-label="Responsável" className="py-3 px-4 align-top">
                    <p className="text-xs font-semibold text-foreground">{item.actorName}</p>
                    {item.actorEmail && (
                      <p className="font-mono text-[11px] text-foreground-muted">
                        {item.actorEmail}
                      </p>
                    )}
                  </td>

                  <td data-label="Resumo" className="py-3 px-4 align-top max-w-[320px]">
                    <p className="text-xs text-foreground leading-relaxed">{item.summary}</p>
                  </td>

                  <td
                    data-label="Data / Hora"
                    className="py-3 px-4 align-top font-mono text-[11px] text-foreground-muted tabular-nums whitespace-nowrap"
                  >
                    {formatDateTimePtBr(item.createdAt)}
                  </td>

                  <td data-label="Detalhes" className="py-3 px-4 align-top text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectedItem(item)}
                      aria-label={`Ver detalhes do evento ${item.actionLabel}`}
                      className="gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-border flex items-center justify-between gap-3 bg-surface-muted/30">
            <p className="text-xs text-foreground-muted tabular-nums">
              Exibindo {items.length} de {totalCount} registros
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || isNavigating}
                onClick={() => navigateWithFilters({ page: page - 1 })}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <span className="font-mono text-xs text-foreground tabular-nums px-1.5">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isNavigating}
                onClick={() => navigateWithFilters({ page: page + 1 })}
                className="gap-1"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Modal Nativo de Detalhes do Evento */}
      <dialog
        ref={detailDialogRef}
        aria-labelledby={detailTitleId}
        onClose={closeDetailModal}
        onPointerDown={(e) => {
          pressedOutsideRef.current = isPointerOutsideDialog(e);
        }}
        onPointerUp={(e) => {
          if (pressedOutsideRef.current && isPointerOutsideDialog(e)) {
            closeDetailModal();
          }
          pressedOutsideRef.current = false;
        }}
        className="w-full max-w-xl rounded-2xl p-0 shadow-elevated bg-surface-elevated text-foreground border border-surface-border"
      >
        {inspectedItem && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                  Detalhes da Auditoria
                </span>
                <h2 id={detailTitleId} className="font-display text-lg font-bold text-foreground">
                  {inspectedItem.actionLabel}
                </h2>
                <p className="font-mono text-xs text-foreground-muted">
                  {inspectedItem.action} • {formatDateTimePtBr(inspectedItem.createdAt)}
                </p>
              </div>

              <button
                type="button"
                autoFocus
                onClick={closeDetailModal}
                aria-label="Fechar detalhes do evento"
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-muted/50 border border-surface-border">
                <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-muted">
                  Responsável pela Ação
                </p>
                <p className="mt-1 font-semibold text-foreground">{inspectedItem.actorName}</p>
                {inspectedItem.actorEmail && (
                  <p className="font-mono text-[11px] text-foreground-muted">
                    {inspectedItem.actorEmail}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-surface-muted/50 border border-surface-border">
                <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-muted">
                  Escopo / Recurso
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {inspectedItem.tenantName ?? "Plataforma DevEssent"}
                </p>
                <p className="font-mono text-[11px] text-foreground-muted">
                  {inspectedItem.resourceLabel}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-muted">
                Resumo Operacional
              </p>
              <p className="text-sm text-foreground leading-relaxed">{inspectedItem.summary}</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-muted">
                Metadados Sanitizados
              </p>
              <pre className="p-3 rounded-lg bg-surface-muted/70 border border-surface-border font-mono text-[11px] text-foreground overflow-x-auto max-h-56 leading-relaxed">
                {JSON.stringify(inspectedItem.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <span className="font-mono text-[11px] text-foreground-muted truncate">
                ID: {inspectedItem.id}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={closeDetailModal}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
