import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { RateLimitError } from "@/core/errors/app-error";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

export interface RateLimitPolicy {
  scope: string;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds: number;
  message: string;
}

export const RATE_LIMIT_POLICIES = {
  authLoginFailure: {
    scope: "auth:login_failure",
    maxAttempts: 5,
    windowSeconds: 300,
    blockSeconds: 300,
    message:
      "Muitas tentativas de login falharam em sequência. Aguarde alguns minutos antes de tentar novamente.",
  },
  authForgotPassword: {
    scope: "auth:forgot_password",
    maxAttempts: 5,
    windowSeconds: 900,
    blockSeconds: 900,
    message:
      "Limite temporário de solicitações de recuperação atingido. Aguarde alguns minutos antes de tentar novamente.",
  },
  invitationCreate: {
    scope: "tenant:invitation_create",
    maxAttempts: 25,
    windowSeconds: 600,
    blockSeconds: 300,
    message:
      "Muitos convites emitidos em um curto intervalo. Aguarde alguns minutos antes de enviar novos convites.",
  },
  invitationAccept: {
    scope: "tenant:invitation_accept",
    maxAttempts: 12,
    windowSeconds: 300,
    blockSeconds: 300,
    message:
      "Muitas tentativas de aceite de convite em sequência. Aguarde alguns instantes e tente novamente.",
  },
  adminTenantOp: {
    scope: "admin:tenant_operation",
    maxAttempts: 30,
    windowSeconds: 300,
    blockSeconds: 300,
    message:
      "Muitas operações administrativas em sequência. Aguarde alguns instantes antes de continuar.",
  },
  retailOrderCheckout: {
    scope: "retail:order_checkout",
    maxAttempts: 12,
    windowSeconds: 300,
    blockSeconds: 300,
    message:
      "Muitas solicitações de pedido enviadas em sequência. Aguarde alguns minutos antes de tentar novamente.",
  },
  retailPaymentSession: {
    scope: "retail:payment_session",
    maxAttempts: 15,
    windowSeconds: 300,
    blockSeconds: 300,
    message:
      "Muitas tentativas de inicialização de pagamento em sequência. Aguarde alguns minutos antes de tentar novamente.",
  },
  retailPaymentWebhook: {
    scope: "retail:payment_webhook",
    maxAttempts: 120,
    windowSeconds: 60,
    blockSeconds: 120,
    message: "Limite de notificações de webhook excedido para esta origem.",
  },
  billingWebhook: {
    scope: "billing:saas_webhook",
    maxAttempts: 120,
    windowSeconds: 60,
    blockSeconds: 120,
    message: "Limite de notificações de webhook de assinaturas SaaS excedido para esta origem.",
  },
  billingAuthorization: {
    scope: "billing:saas_authorization",
    maxAttempts: 20,
    windowSeconds: 300,
    blockSeconds: 300,
    message: "Muitas tentativas de autorização de assinatura em sequência. Aguarde alguns minutos.",
  },
} as const satisfies Record<string, RateLimitPolicy>;

function hashIdentifier(raw: string): string {
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
}

function getClient(override?: SupabaseClient<Database>): SupabaseClient<Database> {
  return override ?? createAdminClient();
}

export class RateLimitService {
  /**
   * Verifica sem consumir se a chave já está temporariamente bloqueada.
   */
  public static async assertNotBlocked(
    policy: RateLimitPolicy,
    rawIdentifier: string,
    adminClient?: SupabaseClient<Database>
  ): Promise<void> {
    if (!adminClient && process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      return;
    }
    const client = getClient(adminClient);
    const identifier = hashIdentifier(rawIdentifier);

    const { data, error } = await client
      .from("rate_limits")
      .select("blocked_until")
      .eq("scope", policy.scope)
      .eq("identifier", identifier)
      .maybeSingle();

    if (error || !data?.blocked_until) {
      return;
    }

    const blockedUntil = new Date(data.blocked_until).getTime();
    const now = Date.now();
    if (blockedUntil > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
      throw new RateLimitError(policy.message, retryAfterSeconds);
    }
  }

  /**
   * Consome uma tentativa na janela atual e lança RateLimitError quando exceder.
   */
  public static async consumeOrThrow(
    policy: RateLimitPolicy,
    rawIdentifier: string,
    adminClient?: SupabaseClient<Database>
  ): Promise<{ remaining: number }> {
    if (!adminClient && process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      return { remaining: policy.maxAttempts };
    }
    const client = getClient(adminClient);
    const identifier = hashIdentifier(rawIdentifier);

    const { data, error } = await client.rpc("consume_rate_limit", {
      p_scope: policy.scope,
      p_identifier: identifier,
      p_max_attempts: policy.maxAttempts,
      p_window_seconds: policy.windowSeconds,
      p_block_seconds: policy.blockSeconds,
    });

    if (error || !data || data.length === 0) {
      return { remaining: policy.maxAttempts };
    }

    const status = data[0];
    if (!status.allowed) {
      throw new RateLimitError(policy.message, status.retry_after_seconds || policy.blockSeconds);
    }

    return { remaining: status.remaining };
  }

  /**
   * Registra uma falha (ex.: senha inválida) retornando true caso tenha excedido.
   */
  public static async recordFailure(
    policy: RateLimitPolicy,
    rawIdentifier: string,
    adminClient?: SupabaseClient<Database>
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const client = getClient(adminClient);
    const identifier = hashIdentifier(rawIdentifier);

    const { data, error } = await client.rpc("consume_rate_limit", {
      p_scope: policy.scope,
      p_identifier: identifier,
      p_max_attempts: policy.maxAttempts,
      p_window_seconds: policy.windowSeconds,
      p_block_seconds: policy.blockSeconds,
    });

    if (error || !data || data.length === 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const status = data[0];
    return {
      allowed: Boolean(status.allowed),
      retryAfterSeconds: Number(status.retry_after_seconds || 0),
    };
  }

  /**
   * Limpa o contador após conclusão bem-sucedida (ex.: login válido).
   */
  public static async reset(
    policy: RateLimitPolicy,
    rawIdentifier: string,
    adminClient?: SupabaseClient<Database>
  ): Promise<void> {
    const client = getClient(adminClient);
    const identifier = hashIdentifier(rawIdentifier);
    await client.rpc("reset_rate_limit", {
      p_scope: policy.scope,
      p_identifier: identifier,
    });
  }
}

