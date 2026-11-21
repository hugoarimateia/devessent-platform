import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/core/errors/app-error";
import {
  getVisibleTenantAuditActions,
  hasPermission,
  type RoleOrAdmin,
} from "@/core/permissions/policies/role-matrix";
import {
  TenantService,
  type TenantContext,
} from "@/core/tenants/services/tenant-service";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabaseClient = SupabaseClient<Database, any, any>;

export interface RecordAuditParams {
  supabase: AppSupabaseClient;
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export type AuditPeriodFilter = "7d" | "30d" | "90d" | "all";

export interface ListAuditLogsFilter {
  tenantId?: string;
  action?: string;
  period?: AuditPeriodFilter;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditActionMeta {
  action: string;
  label: string;
  category: "empresa" | "governanca" | "configuracao" | "convites" | "equipe" | "sistema" | "comercial";
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

export interface AuditLogViewItem {
  id: string;
  action: string;
  actionLabel: string;
  actionCategory: AuditActionMeta["category"];
  actionTone: AuditActionMeta["tone"];
  resourceType: string;
  resourceLabel: string;
  resourceId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  summary: string;
  metadata: Record<string, Json | undefined>;
  createdAt: string;
}

export interface AuditLogListResult {
  items: AuditLogViewItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  viewerRole: RoleOrAdmin;
}

export const AUDIT_ACTION_CATALOG: Record<string, AuditActionMeta> = {
  "tenant.created": {
    action: "tenant.created",
    label: "Estabelecimento cadastrado",
    category: "empresa",
    tone: "success",
  },
  "tenant.sandbox_created": {
    action: "tenant.sandbox_created",
    label: "Estabelecimento sandbox provisionado",
    category: "empresa",
    tone: "neutral",
  },
  "tenant.suspended": {
    action: "tenant.suspended",
    label: "Estabelecimento suspenso",
    category: "governanca",
    tone: "danger",
  },
  "tenant.activated": {
    action: "tenant.activated",
    label: "Estabelecimento reativado",
    category: "governanca",
    tone: "success",
  },
  "tenant.reactivated": {
    action: "tenant.reactivated",
    label: "Estabelecimento reativado",
    category: "governanca",
    tone: "success",
  },
  "tenant_settings.updated": {
    action: "tenant_settings.updated",
    label: "Configurações da unidade atualizadas",
    category: "configuracao",
    tone: "info",
  },
  "invitation.created": {
    action: "invitation.created",
    label: "Convite de acesso emitido",
    category: "convites",
    tone: "info",
  },
  "invitation.accepted": {
    action: "invitation.accepted",
    label: "Convite aceito pelo integrante",
    category: "convites",
    tone: "success",
  },
  "invitation.revoked": {
    action: "invitation.revoked",
    label: "Convite cancelado",
    category: "convites",
    tone: "warning",
  },
  "member.role_updated": {
    action: "member.role_updated",
    label: "Papel de integrante atualizado",
    category: "equipe",
    tone: "info",
  },
  "membership.role_updated": {
    action: "membership.role_updated",
    label: "Papel de integrante atualizado",
    category: "equipe",
    tone: "info",
  },
  "member.removed": {
    action: "member.removed",
    label: "Integrante removido da unidade",
    category: "equipe",
    tone: "warning",
  },
  "membership.removed": {
    action: "membership.removed",
    label: "Integrante removido da unidade",
    category: "equipe",
    tone: "warning",
  },
  "retail.category_created": {
    action: "retail.category_created",
    label: "Categoria comercial criada",
    category: "comercial",
    tone: "success",
  },
  "retail.category_updated": {
    action: "retail.category_updated",
    label: "Categoria comercial atualizada",
    category: "comercial",
    tone: "info",
  },
  "retail.category_deleted": {
    action: "retail.category_deleted",
    label: "Categoria comercial excluída",
    category: "comercial",
    tone: "warning",
  },
  "retail.product_created": {
    action: "retail.product_created",
    label: "Produto adicionado ao catálogo",
    category: "comercial",
    tone: "success",
  },
  "retail.product_updated": {
    action: "retail.product_updated",
    label: "Produto atualizado",
    category: "comercial",
    tone: "info",
  },
  "retail.product_published": {
    action: "retail.product_published",
    label: "Produto publicado no catálogo",
    category: "comercial",
    tone: "success",
  },
  "retail.product_archived": {
    action: "retail.product_archived",
    label: "Produto arquivado do catálogo",
    category: "comercial",
    tone: "warning",
  },
  "retail.variant_created": {
    action: "retail.variant_created",
    label: "Variante comercial cadastrada",
    category: "comercial",
    tone: "success",
  },
  "retail.variant_updated": {
    action: "retail.variant_updated",
    label: "Variante comercial atualizada",
    category: "comercial",
    tone: "info",
  },
  "retail.price_updated": {
    action: "retail.price_updated",
    label: "Preço de produto modificado",
    category: "comercial",
    tone: "warning",
  },
  "retail.stock_adjusted": {
    action: "retail.stock_adjusted",
    label: "Estoque de produto ajustado",
    category: "comercial",
    tone: "info",
  },
  "retail.store_updated": {
    action: "retail.store_updated",
    label: "Parâmetros operacionais da loja atualizados",
    category: "comercial",
    tone: "info",
  },
  "retail.storefront_design_updated": {
    action: "retail.storefront_design_updated",
    label: "Arquitetura visual da vitrine atualizada",
    category: "comercial",
    tone: "info",
  },
  "retail.order_requested": {
    action: "retail.order_requested",
    label: "Solicitação de pedido recebida",
    category: "comercial",
    tone: "info",
  },
  "retail.order_confirmed": {
    action: "retail.order_confirmed",
    label: "Pedido confirmado com baixa de estoque",
    category: "comercial",
    tone: "success",
  },
  "retail.order_status_updated": {
    action: "retail.order_status_updated",
    label: "Status de pedido atualizado",
    category: "comercial",
    tone: "info",
  },
  "retail.order_cancelled": {
    action: "retail.order_cancelled",
    label: "Pedido cancelado",
    category: "comercial",
    tone: "warning",
  },
  "retail.order_shipping_updated": {
    action: "retail.order_shipping_updated",
    label: "Frete do pedido definido",
    category: "comercial",
    tone: "info",
  },
  "retail.payment_account_connected": {
    action: "retail.payment_account_connected",
    label: "Conta de recebimento conectada (Sandbox)",
    category: "governanca",
    tone: "success",
  },
  "retail.payment_account_disconnected": {
    action: "retail.payment_account_disconnected",
    label: "Conta de recebimento desconectada",
    category: "governanca",
    tone: "warning",
  },
  "retail.payment_share_link_generated": {
    action: "retail.payment_share_link_generated",
    label: "Link opaco de pagamento emitido",
    category: "comercial",
    tone: "info",
  },
  "retail.payment_session_created": {
    action: "retail.payment_session_created",
    label: "Sessão de pagamento online iniciada",
    category: "comercial",
    tone: "info",
  },
  "retail.payment_approved": {
    action: "retail.payment_approved",
    label: "Pagamento confirmado pelo gateway",
    category: "comercial",
    tone: "success",
  },
  "retail.payment_failed": {
    action: "retail.payment_failed",
    label: "Pagamento recusado ou expirado",
    category: "comercial",
    tone: "warning",
  },
  "retail.payment_cancelled": {
    action: "retail.payment_cancelled",
    label: "Sessão de pagamento cancelada",
    category: "comercial",
    tone: "warning",
  },
  "retail.payment_refunded": {
    action: "retail.payment_refunded",
    label: "Estorno confirmado pelo gateway",
    category: "comercial",
    tone: "warning",
  },
  "billing.plan_created": {
    action: "billing.plan_created",
    label: "Plano comercial SaaS criado",
    category: "governanca",
    tone: "success",
  },
  "billing.plan_updated": {
    action: "billing.plan_updated",
    label: "Plano comercial SaaS atualizado",
    category: "governanca",
    tone: "info",
  },
  "billing.plan_status_changed": {
    action: "billing.plan_status_changed",
    label: "Status de plano SaaS alterado",
    category: "governanca",
    tone: "warning",
  },
  "billing.subscription_created": {
    action: "billing.subscription_created",
    label: "Assinatura SaaS vinculada à empresa",
    category: "governanca",
    tone: "success",
  },
  "billing.subscription_authorization_requested": {
    action: "billing.subscription_authorization_requested",
    label: "Autorização de recorrência emitida",
    category: "governanca",
    tone: "info",
  },
  "billing.subscription_authorized": {
    action: "billing.subscription_authorized",
    label: "Meio de pagamento recorrente autorizado",
    category: "governanca",
    tone: "success",
  },
  "billing.subscription_activated": {
    action: "billing.subscription_activated",
    label: "Assinatura SaaS ativada conforme contrato",
    category: "governanca",
    tone: "success",
  },
  "billing.subscription_updated": {
    action: "billing.subscription_updated",
    label: "Condições contratuais da assinatura ajustadas",
    category: "governanca",
    tone: "info",
  },
  "billing.subscription_cancelled": {
    action: "billing.subscription_cancelled",
    label: "Assinatura SaaS cancelada ou agendada para cancelamento",
    category: "governanca",
    tone: "warning",
  },
  "billing.invoice_paid": {
    action: "billing.invoice_paid",
    label: "Mensalidade SaaS paga e reconciliada",
    category: "governanca",
    tone: "success",
  },
  "billing.invoice_failed": {
    action: "billing.invoice_failed",
    label: "Falha ou atraso em mensalidade SaaS",
    category: "governanca",
    tone: "warning",
  },
  "billing.contract_created": {
    action: "billing.contract_created",
    label: "Contrato de implantação 50/50 criado",
    category: "governanca",
    tone: "success",
  },
  "billing.contract_updated": {
    action: "billing.contract_updated",
    label: "Contrato de implantação atualizado",
    category: "governanca",
    tone: "info",
  },
  "billing.contract_delivery_confirmed": {
    action: "billing.contract_delivery_confirmed",
    label: "Entrega de implantação confirmada",
    category: "governanca",
    tone: "success",
  },
  "billing.installment_receipt_attached": {
    action: "billing.installment_receipt_attached",
    label: "Comprovante de parcela 50/50 anexado",
    category: "governanca",
    tone: "info",
  },
  "billing.installment_confirmed": {
    action: "billing.installment_confirmed",
    label: "Recebimento manual de implantação confirmado",
    category: "governanca",
    tone: "success",
  },
  "retail.payment_divergence_blocked": {
    action: "retail.payment_divergence_blocked",
    label: "Divergência financeira bloqueada",
    category: "governanca",
    tone: "danger",
  },
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  tenant: "Estabelecimento",
  tenant_settings: "Configurações",
  tenant_invitation: "Convite de Acesso",
  tenant_membership: "Integrante / Vínculo",
  retail_order: "Pedido Comercial",
  retail_payment: "Transação Financeira",
  retail_payment_connection: "Conexão de Pagamento",
};

export const AUDIT_FILTER_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "tenant.created", label: "Estabelecimento cadastrado" },
  { value: "tenant.suspended", label: "Estabelecimento suspenso" },
  { value: "tenant.activated", label: "Estabelecimento reativado" },
  { value: "tenant_settings.updated", label: "Configurações atualizadas" },
  { value: "invitation.created", label: "Convite emitido" },
  { value: "invitation.accepted", label: "Convite aceito" },
  { value: "invitation.revoked", label: "Convite cancelado" },
  { value: "member.role_updated", label: "Papel de integrante atualizado" },
  { value: "member.removed", label: "Integrante removido" },
];

const SENSITIVE_KEY_PATTERN =
  /(password|senha|token|secret|apikey|api_key|service_role|servicerole|jwt|cookie|recovery|authorization|credential|private_key|access_key|refresh)/i;

const JWT_VALUE_PATTERN = /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const INVITE_URL_TOKEN_PATTERN = /\/convite\/[A-Za-z0-9_-]{12,}/i;

const ROLE_TEXT_LABELS: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gestor",
  staff: "Equipe",
  platform_admin: "Admin Global",
};

const FIELD_TEXT_LABELS: Record<string, string> = {
  display_name: "Nome de exibição",
  contact_email: "E-mail de contato",
  contact_phone: "Telefone",
  segment_label: "Segmento",
  primary_color: "Cor primária",
  monogram: "Monograma",
  brand_description: "Descrição institucional",
  timezone: "Fuso horário",
  locale: "Idioma/Região",
};

export function getAuditActionMeta(action: string): AuditActionMeta {
  return (
    AUDIT_ACTION_CATALOG[action] ?? {
      action,
      label: action,
      category: "sistema",
      tone: "neutral",
    }
  );
}

function sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): Json | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    if (JWT_VALUE_PATTERN.test(value.trim()) || INVITE_URL_TOKEN_PATTERN.test(value)) {
      return "[REDACTED]";
    }
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= 5) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    return value
      .slice(0, 50)
      .map((item) => sanitizeValue(item, depth + 1, seen) ?? null);
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    const out: Record<string, Json | undefined> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }
      const sanitizedNested = sanitizeValue(nested, depth + 1, seen);
      if (sanitizedNested !== undefined) {
        out[key] = sanitizedNested;
      }
    }
    return out;
  }

  return String(value);
}

function resolveDateRange(filters: ListAuditLogsFilter): { fromIso?: string; toIso?: string } {
  if (filters.from || filters.to) {
    return {
      fromIso: filters.from ? new Date(`${filters.from}T00:00:00.000Z`).toISOString() : undefined,
      toIso: filters.to ? new Date(`${filters.to}T23:59:59.999Z`).toISOString() : undefined,
    };
  }

  const period = filters.period ?? "30d";
  if (period === "all") {
    return {};
  }

  const daysMap: Record<"7d" | "30d" | "90d", number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = daysMap[period] ?? 30;
  return {
    fromIso: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function expandActionAliases(action: string): string[] {
  if (action === "tenant.activated" || action === "tenant.reactivated") {
    return ["tenant.activated", "tenant.reactivated"];
  }
  if (action === "member.role_updated" || action === "membership.role_updated") {
    return ["member.role_updated", "membership.role_updated"];
  }
  if (action === "member.removed" || action === "membership.removed") {
    return ["member.removed", "membership.removed"];
  }
  return [action];
}

function formatAuditSummary(
  action: string,
  metadata: Record<string, Json | undefined>,
  tenantName: string | null
): string {
  const email = typeof metadata.email === "string" ? metadata.email : null;
  const ownerEmail = typeof metadata.ownerEmail === "string" ? metadata.ownerEmail : null;
  const role = typeof metadata.role === "string" ? ROLE_TEXT_LABELS[metadata.role] ?? metadata.role : null;
  const previousRole =
    typeof metadata.previousRole === "string"
      ? ROLE_TEXT_LABELS[metadata.previousRole] ?? metadata.previousRole
      : null;
  const newRole =
    typeof metadata.newRole === "string"
      ? ROLE_TEXT_LABELS[metadata.newRole] ?? metadata.newRole
      : null;
  const removedRole =
    typeof metadata.removedRole === "string"
      ? ROLE_TEXT_LABELS[metadata.removedRole] ?? metadata.removedRole
      : previousRole;

  switch (action) {
    case "tenant.created":
    case "tenant.sandbox_created": {
      const slug = typeof metadata.slug === "string" ? metadata.slug : null;
      if (ownerEmail && slug) {
        return `Unidade ${slug} criada com responsável ${ownerEmail}.`;
      }
      return tenantName ? `Unidade ${tenantName} provisionada na plataforma.` : "Unidade criada.";
    }
    case "tenant.suspended":
      return tenantName
        ? `Operação da unidade ${tenantName} suspensa por administração global.`
        : "Estabelecimento marcado como suspenso.";
    case "tenant.activated":
    case "tenant.reactivated":
      return tenantName
        ? `Operação da unidade ${tenantName} reativada e liberada para acesso.`
        : "Estabelecimento reativado.";
    case "tenant_settings.updated": {
      const updatedFields = Array.isArray(metadata.updatedFields)
        ? metadata.updatedFields
            .filter((f): f is string => typeof f === "string")
            .map((f) => FIELD_TEXT_LABELS[f] ?? f)
        : [];
      if (updatedFields.length > 0) {
        return `Campos atualizados: ${updatedFields.join(", ")}.`;
      }
      return "Identidade visual e parâmetros gerais salvos.";
    }
    case "invitation.created":
      return email
        ? `Convite enviado para ${email}${role ? ` como ${role}` : ""}.`
        : "Novo convite emitido.";
    case "invitation.accepted":
      return email
        ? `${email} aceitou o convite${role ? ` (${role})` : ""}.`
        : "Convite aceito e vínculo ativado.";
    case "invitation.revoked":
      return email ? `Convite de ${email} cancelado.` : "Convite pendente cancelado.";
    case "member.role_updated":
    case "membership.role_updated":
      if (previousRole && newRole) {
        return `Alçada alterada de ${previousRole} para ${newRole}.`;
      }
      return "Permissão do integrante atualizada.";
    case "member.removed":
    case "membership.removed":
      return removedRole
        ? `Integrante (${removedRole}) desvinculado da unidade.`
        : "Integrante removido da unidade.";
    default:
      return tenantName ? `Evento operacional em ${tenantName}.` : "Evento registrado na plataforma.";
  }
}

export class AuditService {
  /**
   * Sanitiza recursivamente metadados removendo quaisquer chaves ou valores sensíveis.
   */
  public static sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, Json | undefined> {
    const cleaned = sanitizeValue(metadata, 0);
    if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
      return cleaned as Record<string, Json | undefined>;
    }
    return {};
  }

  /**
   * Grava evento de auditoria de forma resiliente, sempre com higienização profunda.
   */
  public static async recordEvent({
    supabase,
    tenantId = null,
    actorUserId = null,
    action,
    resourceType,
    resourceId = null,
    metadata = {},
  }: RecordAuditParams): Promise<void> {
    const sanitizedMetadata = AuditService.sanitizeMetadata(metadata);

    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      await XamppTenantAdapter.recordAudit({
        tenantId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        metadata: (sanitizedMetadata as Record<string, unknown>) || {},
      });
      return;
    }

    const { error } = await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: sanitizedMetadata,
    });

    if (error) {
      console.error("[AUDIT SERVICE ERROR]", error.message);
    }
  }

  /**
   * Lista trilha global de auditoria para Administradores da Plataforma (/admin/atividades).
   */
  public static async listPlatformAuditLogs(
    supabase: AppSupabaseClient,
    actorUserId: string,
    filters: ListAuditLogsFilter = {}
  ): Promise<AuditLogListResult> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const res = await XamppTenantAdapter.listPlatformAuditLogs(actorUserId, {
        tenantId: filters.tenantId,
        action: filters.action !== "all" ? filters.action : undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
      const items: AuditLogViewItem[] = res.items.map((r) => {
        const meta = getAuditActionMeta(r.action);
        return {
          id: r.id,
          action: r.action,
          actionLabel: meta.label,
          actionCategory: meta.category,
          actionTone: meta.tone,
          resourceType: r.resourceType,
          resourceLabel: r.resourceType,
          resourceId: r.resourceId,
          tenantId: r.tenantId,
          tenantName: r.tenantName || null,
          tenantSlug: r.tenantSlug || null,
          actorUserId: r.actorUserId,
          actorName: r.actorName,
          actorEmail: null,
          summary: `${meta.label} (${r.resourceType})`,
          metadata: r.metadata,
          createdAt: r.createdAt,
        };
      });
      return {
        items,
        totalCount: res.totalCount,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: Math.max(1, Math.ceil(res.totalCount / res.pageSize)),
        viewerRole: "platform_admin",
      };
    }

    const { data: adminRow } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!adminRow || !hasPermission("platform_admin", "view_platform_audit_logs")) {
      throw new ForbiddenError("Acesso restrito a administradores globais da plataforma.");
    }

    const adminClient = createAdminClient();
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(filters.pageSize) || 15));
    const { fromIso, toIso } = resolveDateRange(filters);
    const search = filters.search?.trim().toLowerCase() ?? "";

    let query = adminClient
      .from("audit_logs")
      .select("id, tenant_id, actor_user_id, action, resource_type, resource_id, metadata, created_at", {
        count: search ? undefined : "exact",
      })
      .order("created_at", { ascending: false });

    if (filters.tenantId && filters.tenantId !== "all") {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.action && filters.action !== "all") {
      query = query.in("action", expandActionAliases(filters.action));
    }

    if (fromIso) {
      query = query.gte("created_at", fromIso);
    }
    if (toIso) {
      query = query.lte("created_at", toIso);
    }

    if (!search) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      const { data: rows, count, error } = await query.range(start, end);

      if (error) {
        throw new Error("Não foi possível consultar os registros de auditoria.");
      }

      const items = await AuditService.enrichAuditRows(adminClient, rows ?? [], true);
      const totalCount = count ?? items.length;
      return {
        items,
        totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        viewerRole: "platform_admin",
      };
    }

    // Quando há busca textual, busca fatia controlada recente e aplica filtro seguro em memória
    const { data: rows, error } = await query.limit(400);
    if (error) {
      throw new Error("Não foi possível filtrar os registros de auditoria.");
    }

    const enriched = await AuditService.enrichAuditRows(adminClient, rows ?? [], true);
    const filtered = enriched.filter((item) => AuditService.matchesSearch(item, search));
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      viewerRole: "platform_admin",
    };
  }

  /**
   * Lista trilha de auditoria restrita a um único estabelecimento (/dashboard/atividades),
   * utilizando o cliente SSR autenticado sob RLS e aplicando filtro de escopo RBAC por papel.
   */
  public static async listTenantAuditLogs(
    supabase: AppSupabaseClient,
    actorUserId: string,
    tenantId: string,
    filters: ListAuditLogsFilter = {},
    preResolvedContext?: TenantContext
  ): Promise<AuditLogListResult> {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppTenantAdapter } = await import("@/infrastructure/xampp-test/tenant-adapter");
      const context =
        preResolvedContext && preResolvedContext.tenantId === tenantId
          ? preResolvedContext
          : await XamppTenantAdapter.resolveTenantContext(actorUserId, tenantId);
      const res = await XamppTenantAdapter.listTenantAuditLogs(actorUserId, tenantId, {
        action: filters.action !== "all" ? filters.action : undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
      const items: AuditLogViewItem[] = res.items.map((r) => {
        const meta = getAuditActionMeta(r.action);
        return {
          id: r.id,
          action: r.action,
          actionLabel: meta.label,
          actionCategory: meta.category,
          actionTone: meta.tone,
          resourceType: r.resourceType,
          resourceLabel: r.resourceType,
          resourceId: r.resourceId,
          tenantId: r.tenantId,
          tenantName: context.tenantName,
          tenantSlug: context.slug,
          actorUserId: r.actorUserId,
          actorName: r.actorName,
          actorEmail: null,
          summary: `${meta.label} (${r.resourceType})`,
          metadata: r.metadata,
          createdAt: r.createdAt,
        };
      });
      return {
        items,
        totalCount: res.totalCount,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: Math.max(1, Math.ceil(res.totalCount / res.pageSize)),
        viewerRole: context.role,
      };
    }

    const context =
      preResolvedContext &&
      preResolvedContext.tenantId === tenantId &&
      preResolvedContext.userId === actorUserId
        ? preResolvedContext
        : await TenantService.resolveTenantContext(supabase, actorUserId, tenantId);
    if (!hasPermission(context.role, "view_tenant_audit_logs")) {
      throw new ForbiddenError(
        "Seu nível de acesso não permite consultar o histórico de auditoria do estabelecimento."
      );
    }

    const allowedActions = getVisibleTenantAuditActions(context.role);
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(filters.pageSize) || 15));
    const { fromIso, toIso } = resolveDateRange(filters);
    const search = filters.search?.trim().toLowerCase() ?? "";

    // Se papel Manager filtrar explicitamente por ação fora de sua alçada, retorna vazio sem erro
    let requestedActions: string[] | null = allowedActions ? [...allowedActions] : null;
    if (filters.action && filters.action !== "all") {
      const expanded = expandActionAliases(filters.action);
      if (requestedActions) {
        requestedActions = expanded.filter((a) => requestedActions!.includes(a));
        if (requestedActions.length === 0) {
          return {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize,
            totalPages: 1,
            viewerRole: context.role,
          };
        }
      } else {
        requestedActions = expanded;
      }
    }

    let query = supabase
      .from("audit_logs")
      .select(
        "id, tenant_id, actor_user_id, action, resource_type, resource_id, metadata, created_at, profiles(full_name)",
        {
          count: search ? undefined : "exact",
        }
      )
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false });

    if (requestedActions && requestedActions.length > 0) {
      query = query.in("action", requestedActions);
    }

    if (fromIso) {
      query = query.gte("created_at", fromIso);
    }
    if (toIso) {
      query = query.lte("created_at", toIso);
    }

    if (!search) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      const { data: rows, count, error } = await query.range(start, end);

      if (error) {
        throw new Error("Não foi possível consultar a auditoria do estabelecimento.");
      }

      const items = await AuditService.enrichAuditRows(
        supabase,
        rows ?? [],
        false,
        { id: context.tenantId, name: context.tenantName, slug: context.slug }
      );
      const totalCount = count ?? items.length;
      return {
        items,
        totalCount,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        viewerRole: context.role,
      };
    }

    const { data: rows, error } = await query.limit(300);
    if (error) {
      throw new Error("Não foi possível filtrar a auditoria do estabelecimento.");
    }

    const enriched = await AuditService.enrichAuditRows(
      supabase,
      rows ?? [],
      false,
      { id: context.tenantId, name: context.tenantName, slug: context.slug }
    );
    const filtered = enriched.filter((item) => AuditService.matchesSearch(item, search));
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      viewerRole: context.role,
    };
  }

  private static matchesSearch(item: AuditLogViewItem, term: string): boolean {
    const metadataText = JSON.stringify(item.metadata).toLowerCase();
    return (
      item.action.toLowerCase().includes(term) ||
      item.actionLabel.toLowerCase().includes(term) ||
      item.summary.toLowerCase().includes(term) ||
      item.actorName.toLowerCase().includes(term) ||
      (item.actorEmail?.toLowerCase().includes(term) ?? false) ||
      (item.tenantName?.toLowerCase().includes(term) ?? false) ||
      (item.tenantSlug?.toLowerCase().includes(term) ?? false) ||
      metadataText.includes(term)
    );
  }

  private static async enrichAuditRows(
    client: AppSupabaseClient,
    rows: Array<{
      id: string;
      tenant_id: string | null;
      actor_user_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      metadata: Json;
      created_at: string;
      profiles?: { full_name: string } | Array<{ full_name: string }> | null;
    }>,
    includePlatformMetadata: boolean,
    fixedTenant?: { id: string; name: string; slug: string }
  ): Promise<AuditLogViewItem[]> {
    if (rows.length === 0) return [];

    const actorIds = Array.from(
      new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => Boolean(v)))
    );
    const tenantIds = fixedTenant
      ? []
      : Array.from(new Set(rows.map((r) => r.tenant_id).filter((v): v is string => Boolean(v))));

    const profileMap = new Map<string, string>();
    const emailMap = new Map<string, string>();
    const tenantMap = new Map<string, { name: string; slug: string }>();
    const adminActorSet = new Set<string>();

    // Aproveita nomes já trazidos pelo JOIN PostgREST (audit_logs -> profiles) sem roundtrip extra
    let hasEmbeddedProfiles = false;
    for (const r of rows) {
      if (r.profiles !== undefined) {
        hasEmbeddedProfiles = true;
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        if (r.actor_user_id && p?.full_name) {
          profileMap.set(r.actor_user_id, p.full_name);
        }
      }
    }

    const needsProfileFetch = !hasEmbeddedProfiles && actorIds.length > 0;
    const unresolvedEmbeddedActors = hasEmbeddedProfiles
      ? actorIds.filter((id) => !profileMap.has(id))
      : [];
    const admin =
      actorIds.length > 0 && (includePlatformMetadata || needsProfileFetch || unresolvedEmbeddedActors.length > 0)
        ? createAdminClient()
        : null;

    const [profilesRes, authListRes, tenantsRes, embeddedAdminRes] = await Promise.all([
      needsProfileFetch
        ? client.from("profiles").select("id, full_name").in("id", actorIds)
        : Promise.resolve({ data: null }),
      actorIds.length > 0 && includePlatformMetadata && admin
        ? admin.auth.admin.listUsers({ perPage: 1000 })
        : Promise.resolve({ data: null }),
      !fixedTenant && tenantIds.length > 0
        ? client.from("tenants").select("id, name, slug").in("id", tenantIds)
        : Promise.resolve({ data: null }),
      !includePlatformMetadata && hasEmbeddedProfiles && unresolvedEmbeddedActors.length > 0 && admin
        ? admin.from("platform_admins").select("user_id").in("user_id", unresolvedEmbeddedActors)
        : Promise.resolve({ data: null }),
    ]);

    for (const p of profilesRes.data ?? []) {
      profileMap.set(p.id, p.full_name);
    }

    for (const row of embeddedAdminRes.data ?? []) {
      adminActorSet.add(row.user_id);
    }

    if (includePlatformMetadata) {
      for (const u of authListRes.data?.users ?? []) {
        if (u.email && actorIds.includes(u.id)) {
          emailMap.set(u.id, u.email);
        }
      }
    } else if (!hasEmbeddedProfiles && actorIds.length > 0 && admin) {
      const unresolvedActors = actorIds.filter((id) => !profileMap.has(id));
      if (unresolvedActors.length > 0) {
        const { data: adminRows } = await admin
          .from("platform_admins")
          .select("user_id")
          .in("user_id", unresolvedActors);
        for (const row of adminRows ?? []) {
          adminActorSet.add(row.user_id);
        }
      }
    }

    for (const t of tenantsRes.data ?? []) {
      tenantMap.set(t.id, { name: t.name, slug: t.slug });
    }

    return rows.map((row) => {
      const meta = getAuditActionMeta(row.action);
      const rawMetaObj =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const safeMetadata = AuditService.sanitizeMetadata(rawMetaObj);

      const tenantInfo = fixedTenant
        ? row.tenant_id === fixedTenant.id
          ? { name: fixedTenant.name, slug: fixedTenant.slug }
          : null
        : row.tenant_id
          ? tenantMap.get(row.tenant_id) ?? null
          : null;

      let actorName = "Sistema / Automação";
      if (row.actor_user_id) {
        actorName =
          profileMap.get(row.actor_user_id) ??
          (adminActorSet.has(row.actor_user_id) ? "Administração Global" : "Usuário Desvinculado");
      }

      return {
        id: row.id,
        action: row.action,
        actionLabel: meta.label,
        actionCategory: meta.category,
        actionTone: meta.tone,
        resourceType: row.resource_type,
        resourceLabel: RESOURCE_TYPE_LABELS[row.resource_type] ?? row.resource_type,
        resourceId: row.resource_id,
        tenantId: row.tenant_id,
        tenantName: tenantInfo?.name ?? null,
        tenantSlug: tenantInfo?.slug ?? null,
        actorUserId: row.actor_user_id,
        actorName,
        actorEmail: row.actor_user_id ? emailMap.get(row.actor_user_id) ?? null : null,
        summary: formatAuditSummary(row.action, safeMetadata, tenantInfo?.name ?? null),
        metadata: safeMetadata,
        createdAt: row.created_at,
      };
    });
  }
}
