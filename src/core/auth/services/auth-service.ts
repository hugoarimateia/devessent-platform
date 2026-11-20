import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "@/types/database.types";
import type { SessionUser } from "../types/auth.types";
import { UnauthorizedError } from "@/core/errors/app-error";
import { env } from "@/lib/environment/env";
import { isXamppTestMode } from "@/lib/environment/backend-mode";
import {
  MW_AUTH_BRIDGE_HEADER,
  verifyMiddlewareAuthBridgeHeader,
  type VerifiedMiddlewareAuthUser,
} from "@/lib/supabase/auth-bridge";
import { logPerfSpan, perfNow } from "@/lib/perf/perf-trace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppSupabaseClient = SupabaseClient<Database, any, any>;

function getExpectedCookiePrefix(): string {
  try {
    const hostname = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    const ref = hostname.split(".")[0];
    if (ref && /^[a-z0-9-]+$/i.test(ref)) {
      return `sb-${ref}-`;
    }
  } catch {
    // fallback seguro
  }
  return "sb-";
}

async function tryReadVerifiedMiddlewareUser(): Promise<VerifiedMiddlewareAuthUser | null> {
  try {
    const { headers, cookies } = await import("next/headers");
    const [hdrs, cookieStore] = await Promise.all([headers(), cookies()]);
    const bridgeHeader = hdrs.get(MW_AUTH_BRIDGE_HEADER);
    if (!bridgeHeader) return null;

    return verifyMiddlewareAuthBridgeHeader({
      headerValue: bridgeHeader,
      cookiesList: cookieStore.getAll(),
      cookiePrefix: getExpectedCookiePrefix(),
    });
  } catch {
    // Fora de contexto de requisição Next.js (testes unitários/integração) -> fallback padrão
    return null;
  }
}

export class AuthService {
  /**
   * Autenticação de credenciais via Supabase Auth.
   */
  public static async signInWithPassword(
    supabase: AppSupabaseClient,
    credentials: { email: string; password: string }
  ) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        const isNetworkError =
          error.name === "AuthRetryableFetchError" ||
          error.status === 0 ||
          error.message?.toLowerCase().includes("fetch failed") ||
          error.message?.toLowerCase().includes("econnrefused");

        if (isNetworkError) {
          console.error("[AuthService] Backend de autenticação indisponível:", error.message);
          return {
            success: false as const,
            error:
              "Serviço de autenticação indisponível no momento. Verifique se o backend está ativo.",
            isServiceUnavailable: true as const,
          };
        }

        return {
          success: false as const,
          error: "E-mail ou senha incorretos. Verifique suas credenciais.",
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false as const,
          error: "E-mail ou senha incorretos. Verifique suas credenciais.",
        };
      }

      return {
        success: true as const,
        user: data.user,
        session: data.session,
      };
    } catch (err) {
      console.error(
        "[AuthService] Exceção ao conectar com o serviço de autenticação:",
        err instanceof Error ? err.message : "Erro desconhecido"
      );
      return {
        success: false as const,
        error:
          "Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes.",
        isServiceUnavailable: true as const,
      };
    }
  }

  /**
   * Encerramento de sessão no Supabase Auth.
   */
  public static async signOut(supabase: AppSupabaseClient) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erro ao encerrar sessão:", error.message);
    }
  }

  /**
   * Solicitação de recuperação de senha por e-mail.
   * Redireciona o fluxo para o Route Handler /auth/callback com destino /redefinir-senha.
   */
  public static async sendPasswordResetEmail(
    supabase: AppSupabaseClient,
    email: string
  ) {
    const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/redefinir-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.warn("Aviso na recuperação de senha:", error.message);
    }

    // Resposta genérica proposital para evitar enumeração de contas
    return {
      success: true as const,
      message:
        "Se o e-mail informado estiver cadastrado, as instruções para redefinição foram enviadas.",
    };
  }

  /**
   * Atualização de senha de usuário em contexto autenticado ou de recuperação.
   */
  public static async updateUserPassword(
    supabase: AppSupabaseClient,
    newPassword: string
  ) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false as const,
        error: error.message || "Falha ao redefinir a senha. O link pode ter expirado.",
      };
    }

    return {
      success: true as const,
      user: data.user,
    };
  }

  /**
   * Resolve a identidade GoTrue verificada da requisição atual:
   * - Em requisições vindas do Middleware SSR, reutiliza a verificação autoritativa já executada
   *   via ponte HMAC-SHA256 vinculada aos cookies da requisição (evitando 2º roundtrip HTTP).
   * - Em Server Actions, testes ou chamadas diretas sem ponte válida, executa `supabase.auth.getUser()`.
   */
  public static resolveVerifiedAuthUser = cache(async (
    supabase: AppSupabaseClient
  ): Promise<VerifiedMiddlewareAuthUser | null> => {
    const t0 = perfNow();
    const bridged = await tryReadVerifiedMiddlewareUser();
    if (bridged) {
      logPerfSpan("auth", "resolveVerifiedAuthUser.bridgeHit", perfNow() - t0);
      return bridged;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    logPerfSpan("auth", "resolveVerifiedAuthUser.goTrueRtt", perfNow() - t0, {
      ok: Boolean(!userErr && user),
    });

    if (userErr || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      fullName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
      createdAt: user.created_at,
    };
  });

  /**
   * Resolução da identidade autenticada com perfil e checagem de privilégios.
   * Utiliza validação autoritativa junto ao GoTrue (com deduplicação segura Middleware -> RSC).
   * Memoizado por requisição via React.cache para eliminar roundtrips repetidos.
   */
  public static getSessionUser = cache(async (
    supabase: AppSupabaseClient
  ): Promise<SessionUser | null> => {
    if (process.env.NODE_ENV !== "production" && isXamppTestMode()) {
      const { XamppAuthAdapter } = await import("@/infrastructure/xampp-test/auth");
      return XamppAuthAdapter.getSessionUser();
    }

    try {
      const user = await this.resolveVerifiedAuthUser(supabase);
      if (!user) {
        return null;
      }

      const tDb = perfNow();
      // Buscar perfil do usuário e checagem de platform admin em paralelo
      const [profileRes, adminRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_path, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      logPerfSpan("auth", "getSessionUser.profileAndAdmin", perfNow() - tDb);

      const profile = profileRes.data;
      const adminRecord = adminRes.data;
      const isPlatformAdmin = Boolean(adminRecord);

      return {
        id: user.id,
        email: user.email,
        fullName:
          typeof profile?.full_name === "string"
            ? profile.full_name
            : user.fullName || "Usuário",
        avatarPath: typeof profile?.avatar_path === "string" ? profile.avatar_path : null,
        createdAt: typeof profile?.created_at === "string" ? profile.created_at : user.createdAt,
        isPlatformAdmin,
      };
    } catch (err) {
      console.warn(
        "[AuthService] Falha ao consultar sessão do usuário:",
        err instanceof Error ? err.message : "Erro desconhecido"
      );
      return null;
    }
  });

  /**
   * Assegura que há um usuário autenticado ou dispara UnauthorizedError.
   */
  public static async requireSessionUser(
    supabase: AppSupabaseClient
  ): Promise<SessionUser> {
    const sessionUser = await this.getSessionUser(supabase);
    if (!sessionUser) {
      throw new UnauthorizedError("Sessão expirada ou não autenticada.");
    }
    return sessionUser;
  }
}
