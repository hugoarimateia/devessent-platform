import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthService } from "@/core/auth/services/auth-service";
import { AuditService } from "@/core/audit";
import { TenantService } from "@/core/tenants";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Building2,
  PlusCircle,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Console Central DevEssent | Administração Global",
  description: "Painel exclusivo para administradores da plataforma DevEssent.",
};

export default async function AdminGlobalPage() {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  const adminSupabase = createAdminClient();
  const [tenants, auditPreview] = await Promise.all([
    TenantService.listAllTenants(adminSupabase, sessionUser!.id),
    AuditService.listPlatformAuditLogs(supabase, sessionUser!.id, {
      period: "all",
      page: 1,
      pageSize: 6,
    }),
  ]);
  const recentAudits = auditPreview.items;
  const totalAuditCount = auditPreview.totalCount;

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;
  const activeRatio =
    tenants.length > 0 ? Math.round((activeCount / tenants.length) * 100) : 100;

  return (
    <AppShell user={sessionUser!} contextMode="platform">
      <div className="space-y-7">
        {/* Cabeçalho Editorial da Administração Central */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-surface-border">
          <div className="space-y-2 max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Governança Global · DevEssent Admin
            </p>
            <h1 className="font-display text-[1.875rem] sm:text-[2.375rem] font-bold tracking-[-0.03em] text-foreground leading-[1.06]">
              Painel Central de Gestão SaaS
            </h1>
            <p className="text-sm text-foreground-muted leading-relaxed">
              Visão executiva de estabelecimentos registrados, provisionamento atômico com proprietário inicial e trilha de auditoria.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <Link
              href="/admin/empresas"
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-[10px] border border-surface-border bg-surface hover:bg-surface-muted text-[13px] font-semibold text-foreground transition-colors"
            >
              <Building2 className="w-4 h-4 text-foreground-muted" />
              <span>Gerenciar Empresas</span>
            </Link>
            <Link
              href="/admin/empresas/nova"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-[10px] bg-[#10131C] text-white dark:bg-accent hover:bg-[#1E2436] dark:hover:bg-accent-secondary text-[13px] font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Cadastrar Empresa</span>
            </Link>
          </div>
        </header>

        {/* Faixa Assimétrica de Indicadores: Destaque Escuro (5 cols) + Ledger Triplo (7 cols) */}
        <section
          aria-label="Indicadores da plataforma"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
        >
          {/* Bloco Principal Obsidian (Referência 01/02) */}
          <div className="lg:col-span-5 relative overflow-hidden rounded-xl border border-[#232A3E] bg-[#10131C] text-white p-6 flex flex-col justify-between gap-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full opacity-35"
              style={{
                background:
                  "radial-gradient(circle, rgba(133, 117, 242, 0.42) 0%, rgba(16, 19, 28, 0) 70%)",
              }}
            />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A99DFF]">
                Total de Estabelecimentos
              </span>
              <Building2 className="w-4 h-4 text-[#A99DFF]" />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-baseline gap-3">
                <p className="font-display text-4xl font-bold tracking-tight tabular-nums leading-none">
                  {tenants.length}
                </p>
                <span className="text-xs text-[#A9B2C7]">
                  unidades provisionadas na base
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-white/75 tabular-nums">
                  <span>Taxa de operação regular</span>
                  <span>{activeRatio}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${activeRatio}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Horizontal Unificado (3 colunas com divisor fino) */}
          <div className="lg:col-span-7 rounded-xl border border-surface-border bg-surface overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-border">
            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Unidades Ativas
              </p>
              <div>
                <p className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                  {activeCount}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-2">
                  Em operação regular
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Unidades Suspensas
              </p>
              <div>
                <p className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                  {suspendedCount}
                </p>
                <p className="text-xs text-foreground-muted mt-2">
                  {suspendedCount === 0
                    ? "Nenhuma suspensão ativa"
                    : "Bloqueadas via RLS"}
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Eventos Auditados
              </p>
              <div>
                <p className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                  {totalAuditCount ?? 0}
                </p>
                <p className="text-xs text-accent font-medium mt-2">
                  Trilha persistida em SQL
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Grade Assimétrica: Tabela Retail-OS Unificada (8 cols) + Timeline de Auditoria (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section
            aria-label="Estabelecimentos cadastrados"
            className="lg:col-span-8 rounded-xl border border-surface-border bg-surface overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-foreground tracking-tight">
                    Estabelecimentos Cadastrados na Plataforma
                  </h2>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted text-foreground tabular-nums">
                    {tenants.length}
                  </span>
                </div>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Empresas provisionadas, slugs canônicos e proprietários iniciais.
                </p>
              </div>

              <Link
                href="/admin/empresas"
                className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-semibold self-start sm:self-auto"
              >
                <span>Ver todos ({tenants.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {tenants.length === 0 ? (
              <EmptyState
                embedded
                icon={<Building2 className="w-6 h-6" />}
                title="Nenhum estabelecimento cadastrado"
                description="Inicie o cadastro da primeira empresa comercial na plataforma."
              />
            ) : (
              <DataTable
                embedded
                ariaLabel="Estabelecimentos Cadastrados na Plataforma"
              >
                <thead>
                  <tr className="border-b border-surface-border bg-surface-muted/40 text-foreground-muted text-[11px] uppercase tracking-[0.08em]">
                    <th className="py-3 px-5 font-semibold">Estabelecimento</th>
                    <th className="py-3 px-4 font-semibold">Slug</th>
                    <th className="py-3 px-4 font-semibold">Proprietário</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-xs">
                  {tenants.slice(0, 8).map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-surface-muted/40 transition-colors"
                    >
                      <td
                        data-label="Estabelecimento"
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
                        data-label="Cadastro"
                        className="py-3.5 px-5 font-mono text-foreground-muted tabular-nums text-right"
                      >
                        {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          {/* Coluna Lateral (4 cols): Timeline Vertical de Auditoria + Ação Rápida */}
          <aside className="lg:col-span-4 space-y-5">
            <section
              aria-label="Atividade recente"
              className="rounded-xl border border-surface-border bg-surface overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
                  Atividade Recente
                </h3>
                <Link
                  href="/admin/atividades"
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent hover:underline"
                >
                  <span>Ver tudo</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {recentAudits.length === 0 ? (
                <p className="text-xs text-foreground-muted py-6 text-center px-5">
                  Nenhum evento recente registrado.
                </p>
              ) : (
                <div className="p-5">
                  <ol className="relative border-l border-surface-border pl-4 space-y-4">
                    {recentAudits.map((event) => (
                      <li key={event.id} className="relative">
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-full bg-accent ring-4 ring-surface absolute -left-[20.5px] top-1.5"
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-snug">
                              {event.actionLabel}
                            </p>
                            <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                              {event.tenantName ? `${event.tenantName} · ` : ""}
                              <span className="font-mono">{event.action}</span>
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-foreground-muted tabular-nums shrink-0 mt-0.5">
                            {new Date(event.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            <div className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                Provisionamento Atômico
              </p>
              <h3 className="font-display text-sm font-bold text-foreground">
                Expansão de Unidades Comerciais
              </h3>
              <p className="text-xs text-foreground-muted leading-relaxed">
                Crie um novo estabelecimento vinculando imediatamente o proprietário inicial e as configurações padrão na mesma transação.
              </p>
              <Link
                href="/admin/empresas/nova"
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] bg-[#10131C] text-white dark:bg-accent text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <span>Cadastrar Nova Empresa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
