"use client";

import * as React from "react";
import {
  Trash2,
  Mail,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { DataTable } from "@/components/ui/data-table";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
  type MembershipActionState,
} from "@/app/actions/membership.actions";
import type { TenantMemberItem, TenantInvitationItem } from "@/core/tenants";
import type { MembershipRole } from "@/types/database.types";

interface MembersManagerProps {
  tenantId: string;
  currentUserId: string;
  currentUserRole: string;
  members: TenantMemberItem[];
  invitations: TenantInvitationItem[];
}

export function MembersManager({
  tenantId,
  currentUserId,
  currentUserRole,
  members,
  invitations,
}: MembersManagerProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"manager" | "staff">("staff");
  const [isPending, startTransition] = React.useTransition();
  const [actionFeedback, setActionFeedback] =
    React.useState<MembershipActionState | null>(null);
  const [copiedLink, setCopiedLink] = React.useState<"idle" | "copied" | "failed">("idle");
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | MembershipRole>(
    "all"
  );
  const [inviteTab, setInviteTab] = React.useState<"all" | "pending" | "closed">("all");

  const [pendingRoleChange, setPendingRoleChange] = React.useState<{
    userId: string;
    fullName: string;
    currentRole: MembershipRole;
    newRole: "manager" | "staff";
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = React.useState<{
    userId: string;
    fullName: string;
  } | null>(null);
  const [pendingRevoke, setPendingRevoke] = React.useState<{
    invitationId: string;
    email: string;
  } | null>(null);

  const isOwner =
    currentUserRole === "owner" || currentUserRole === "platform_admin";
  const isManager = currentUserRole === "manager";
  const canManage = isOwner || isManager;

  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
      );
    });
  }, [members, roleFilter, searchQuery]);

  const handleInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    setActionFeedback(null);
    const formData = new FormData();
    formData.append("email", email);
    formData.append("role", role);

    startTransition(async () => {
      const result = await inviteMemberAction(tenantId, null, formData);
      setActionFeedback(result);
      if (result.success) {
        setEmail("");
      }
    });
  };

  const executeRoleChange = () => {
    if (!pendingRoleChange || isPending) return;
    const { userId, newRole } = pendingRoleChange;
    setActionFeedback(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(
        tenantId,
        userId,
        newRole
      );
      setActionFeedback(result);
      setPendingRoleChange(null);
    });
  };

  const handleReinvite = (targetEmail: string, targetRole: MembershipRole) => {
    if (isPending) return;
    setActionFeedback(null);
    const allowedRole: "manager" | "staff" =
      isOwner && targetRole === "manager" ? "manager" : "staff";
    const formData = new FormData();
    formData.append("email", targetEmail);
    formData.append("role", allowedRole);

    startTransition(async () => {
      const result = await inviteMemberAction(tenantId, null, formData);
      setActionFeedback(result);
    });
  };

  const executeRemoveMember = () => {
    if (!pendingRemoval || isPending) return;
    const { userId } = pendingRemoval;
    setActionFeedback(null);
    startTransition(async () => {
      const result = await removeMemberAction(tenantId, userId);
      setActionFeedback(result);
      setPendingRemoval(null);
    });
  };

  const executeRevokeInvite = () => {
    if (!pendingRevoke || isPending) return;
    const { invitationId } = pendingRevoke;
    setActionFeedback(null);
    startTransition(async () => {
      const result = await revokeInvitationAction(tenantId, invitationId);
      setActionFeedback(result);
      setPendingRevoke(null);
    });
  };

  const copyToClipboard = async (text: string) => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    try {
      await navigator.clipboard.writeText(window.location.origin + text);
      setCopiedLink("copied");
    } catch {
      setCopiedLink("failed");
    }
    copyTimerRef.current = setTimeout(() => setCopiedLink("idle"), 2500);
  };

  const filteredInvitations = React.useMemo(() => {
    return invitations.filter((inv) => {
      if (inviteTab === "pending") return inv.status === "pending";
      if (inviteTab === "closed") {
        return inv.status === "expired" || inv.status === "revoked";
      }
      return true;
    });
  }, [invitations, inviteTab]);

  const emailFieldError = actionFeedback?.fieldErrors?.email?.[0];

  const roleTabs: Array<{
    key: "all" | MembershipRole;
    label: string;
    count: number;
  }> = [
    { key: "all", label: "Todos", count: members.length },
    {
      key: "owner",
      label: "Proprietários",
      count: members.filter((m) => m.role === "owner").length,
    },
    {
      key: "manager",
      label: "Gestores",
      count: members.filter((m) => m.role === "manager").length,
    },
    {
      key: "staff",
      label: "Equipe",
      count: members.filter((m) => m.role === "staff").length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Feedback de ação (preserva span.font-mono para URL de convite) */}
      {actionFeedback && (
        <div
          role="alert"
          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${
            actionFeedback.success
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {actionFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="font-bold">
                {actionFeedback.success
                  ? "Operação concluída"
                  : "Falha na operação"}
              </p>
              <p className="mt-0.5 opacity-90">
                {actionFeedback.message || actionFeedback.error}
              </p>
              {actionFeedback.inviteUrl && (
                <div className="mt-2.5 flex items-center flex-wrap gap-2">
                  <span
                    id="generated-invite-url"
                    className="font-mono text-[11px] bg-surface px-2.5 py-1 rounded-lg border border-surface-border text-foreground break-all"
                  >
                    {actionFeedback.inviteUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(actionFeedback.inviteUrl!)}
                    aria-label="Copiar link de convite gerado"
                    className="inline-flex items-center gap-1.5 min-h-[28px] px-2 rounded-md text-xs text-accent hover:bg-surface font-semibold cursor-pointer transition-colors"
                  >
                    {copiedLink === "copied" ? (
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {copiedLink === "copied"
                        ? "Copiado!"
                        : copiedLink === "failed"
                          ? "Falha ao copiar"
                          : "Copiar Link"}
                    </span>
                  </button>
                  <span className="sr-only" role="status">
                    {copiedLink === "copied"
                      ? "Link de convite copiado para a área de transferência."
                      : copiedLink === "failed"
                        ? "Não foi possível copiar automaticamente."
                        : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            aria-label="Fechar alerta"
            className="text-foreground-muted hover:text-foreground text-xs shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra Horizontal Enxuta para Emissão de Convite */}
      {canManage && (
        <section
          aria-label="Convidar novo membro"
          className="rounded-xl border border-surface-border bg-surface p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-surface-border pb-3">
            <h2 className="font-display text-sm font-bold text-foreground">
              Convidar Novo Membro
            </h2>
            <p className="text-xs text-foreground-muted">
              Emita um link único por e-mail definindo a alçada operacional.
            </p>
          </div>

          <form
            onSubmit={handleInvite}
            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end"
          >
            <div className="md:col-span-6">
              <Label htmlFor="inviteEmail" required>
                E-mail Corporativo do Convidado
              </Label>
              <Input
                id="inviteEmail"
                type="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                aria-invalid={emailFieldError ? "true" : "false"}
                aria-describedby={emailFieldError ? "invite-email-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                disabled={isPending}
              />
              {emailFieldError && (
                <p
                  id="invite-email-error"
                  className="mt-1 text-xs font-medium text-red-600 dark:text-red-400"
                >
                  {emailFieldError}
                </p>
              )}
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="inviteRole" required>
                Papel Atribuído
              </Label>
              <Select
                id="inviteRole"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "manager" | "staff")
                }
                disabled={isPending}
              >
                <option value="staff">Equipe (staff)</option>
                {isOwner && <option value="manager">Gestor (manager)</option>}
              </Select>
            </div>

            <div className="md:col-span-3">
              <Button
                type="submit"
                isLoading={isPending}
                className="w-full min-h-[44px]"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Emitir Convite</span>
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Painel Unificado Retail OS: Filtros + Busca + Membros Ativos */}
      <section
        aria-label="Membros ativos"
        className="rounded-xl border border-surface-border bg-surface overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-surface-border space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-foreground tracking-tight">
                  Membros do Estabelecimento ({members.length})
                </h2>
              </div>
              <p className="text-xs text-foreground-muted mt-0.5">
                Integrantes com acesso ativo e governança RBAC nesta unidade.
              </p>
            </div>

            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar membro por nome..."
              ariaLabel="Buscar membros"
              className="w-full sm:w-64"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filtrar membros por papel"
            className="inline-flex items-center flex-wrap gap-1 p-1 rounded-[10px] bg-surface-muted border border-surface-border"
          >
            {roleTabs.map((tab) => {
              const isSelected = roleFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setRoleFilter(tab.key)}
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
        </div>

        {filteredMembers.length === 0 ? (
          <EmptyState
            embedded
            icon={<Users className="w-6 h-6" />}
            title="Nenhum membro encontrado"
            description="Nenhum integrante corresponde ao filtro selecionado."
          />
        ) : (
          <DataTable embedded ariaLabel="Membros do Estabelecimento">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted/40 text-foreground-muted text-[11px] uppercase tracking-[0.08em]">
                <th className="py-3 px-5 font-semibold">Nome</th>
                <th className="py-3 px-4 font-semibold">Papel</th>
                <th className="py-3 px-4 font-semibold">Data de Vínculo</th>
                {canManage && (
                  <th className="py-3 px-5 font-semibold text-right">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-xs">
              {filteredMembers.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isMemberOwner = member.role === "owner";
                const isMemberManager = member.role === "manager";

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-surface-muted/40 transition-colors"
                  >
                    <td
                      data-label="Nome"
                      className="py-3.5 px-5 font-semibold text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span>{member.fullName}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-muted border border-surface-border text-foreground-muted font-mono">
                            você
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Papel" className="py-3.5 px-4">
                      <RoleBadge role={member.role} />
                    </td>
                    <td
                      data-label="Vínculo"
                      className="py-3.5 px-4 font-mono text-foreground-muted tabular-nums"
                    >
                      {new Date(member.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    {canManage && (
                      <td
                        data-label="Ações"
                        className="py-3.5 px-5 text-right space-x-2"
                      >
                        {isOwner && !isSelf && !isMemberOwner && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingRoleChange({
                                userId: member.userId,
                                fullName: member.fullName,
                                currentRole: member.role,
                                newRole: isMemberManager ? "staff" : "manager",
                              })
                            }
                            disabled={isPending}
                            className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold transition-colors cursor-pointer"
                          >
                            {isMemberManager ? "Tornar Equipe" : "Tornar Gestor"}
                          </button>
                        )}

                        {!isSelf &&
                          !isMemberOwner &&
                          (isOwner || (isManager && member.role === "staff")) && (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingRemoval({
                                  userId: member.userId,
                                  fullName: member.fullName,
                                })
                              }
                              disabled={isPending}
                              className="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 hover:bg-red-500/20 transition-colors inline-flex items-center gap-1 font-semibold cursor-pointer"
                              aria-label={`Remover ${member.fullName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </button>
                          )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </section>

      {/* Convites Emitidos (Pendentes, Expirados e Revogados) */}
      {canManage && invitations.length > 0 && (
        <section
          aria-label="Convites emitidos"
          className="rounded-xl border border-surface-border bg-surface overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent" />
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                Convites Emitidos ({invitations.length})
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Filtrar convites por situação"
              className="inline-flex items-center gap-1 p-1 rounded-[10px] bg-surface-muted border border-surface-border self-start sm:self-auto"
            >
              {[
                { key: "all" as const, label: "Todos", count: invitations.length },
                {
                  key: "pending" as const,
                  label: "Pendentes",
                  count: invitations.filter((i) => i.status === "pending").length,
                },
                {
                  key: "closed" as const,
                  label: "Expirados / Revogados",
                  count: invitations.filter(
                    (i) => i.status === "expired" || i.status === "revoked"
                  ).length,
                },
              ].map((tab) => {
                const isSelected = inviteTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setInviteTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
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
          </div>

          {filteredInvitations.length === 0 ? (
            <EmptyState
              embedded
              icon={<Mail className="w-6 h-6" />}
              title="Nenhum convite neste filtro"
              description="Altere a aba acima para visualizar convites pendentes, expirados ou revogados."
            />
          ) : (
            <DataTable embedded ariaLabel="Convites de acesso emitidos">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted/40 text-foreground-muted text-[11px] uppercase tracking-[0.08em]">
                  <th className="py-3 px-5 font-semibold">E-mail</th>
                  <th className="py-3 px-4 font-semibold">Papel Convidado</th>
                  <th className="py-3 px-4 font-semibold">Situação</th>
                  <th className="py-3 px-4 font-semibold">Validade</th>
                  <th className="py-3 px-5 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {filteredInvitations.map((inv) => {
                  const canResend = inv.status === "expired" || inv.status === "revoked";
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-surface-muted/40 transition-colors"
                    >
                      <td
                        data-label="E-mail"
                        className="py-3.5 px-5 font-mono text-xs text-foreground"
                      >
                        {inv.email}
                      </td>
                      <td data-label="Papel" className="py-3.5 px-4">
                        <RoleBadge role={inv.role} />
                      </td>
                      <td data-label="Situação" className="py-3.5 px-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td
                        data-label="Validade"
                        className="py-3.5 px-4 font-mono text-foreground-muted tabular-nums"
                      >
                        {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td data-label="Ação" className="py-3.5 px-5 text-right">
                        {inv.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingRevoke({
                                invitationId: inv.id,
                                email: inv.email,
                              })
                            }
                            disabled={isPending}
                            className="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300 hover:bg-red-500/20 font-semibold transition-colors cursor-pointer"
                          >
                            Revogar
                          </button>
                        ) : canResend ? (
                          <button
                            type="button"
                            onClick={() => handleReinvite(inv.email, inv.role)}
                            disabled={isPending}
                            className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted text-xs text-foreground font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reenviar</span>
                          </button>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
      )}

      {/* Diálogo Nativo de Confirmação para Alteração de Papel */}
      <ConfirmationDialog
        open={Boolean(pendingRoleChange)}
        onClose={() => setPendingRoleChange(null)}
        onConfirm={executeRoleChange}
        isLoading={isPending}
        variant="primary"
        title="Confirmar Alteração de Papel"
        description={
          pendingRoleChange?.newRole === "manager"
            ? `Promover "${pendingRoleChange.fullName}" para Gestor concederá acesso a configurações da unidade, convites de equipe e histórico operacional de auditoria.`
            : `Alterar "${pendingRoleChange?.fullName}" para Equipe restringirá o acesso às permissões operacionais básicas, removendo gestão de membros e configurações.`
        }
        confirmLabel="Confirmar Alteração"
      />

      {/* Diálogo Nativo de Confirmação para Remoção de Membro */}
      <ConfirmationDialog
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        onConfirm={executeRemoveMember}
        isLoading={isPending}
        variant="danger"
        title="Revogar Acesso do Membro"
        description={`Deseja realmente remover "${pendingRemoval?.fullName}" deste estabelecimento? O usuário perderá imediatamente o acesso aos dados protegidos por RLS.`}
        confirmLabel="Confirmar Remoção"
      />

      {/* Diálogo Nativo de Confirmação para Revogação de Convite */}
      <ConfirmationDialog
        open={Boolean(pendingRevoke)}
        onClose={() => setPendingRevoke(null)}
        onConfirm={executeRevokeInvite}
        isLoading={isPending}
        variant="danger"
        title="Revogar Convite Pendente"
        description={`Deseja invalidar o convite enviado para "${pendingRevoke?.email}"? O link de aceitação deixará de funcionar imediatamente.`}
        confirmLabel="Confirmar Revogação"
      />
    </div>
  );
}
