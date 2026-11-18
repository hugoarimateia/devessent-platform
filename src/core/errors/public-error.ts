import { AppError, RateLimitError, ValidationError } from "@/core/errors/app-error";

const TECHNICAL_LEAK_PATTERNS = [
  /postgres/i,
  /sqlstate/i,
  /pgrst\d+/i,
  /violates .* constraint/i,
  /duplicate key value/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /permission denied for/i,
  /row-level security/i,
  /jwt/i,
  /stack trace/i,
];

function looksTechnical(message: string): boolean {
  return TECHNICAL_LEAK_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Converte erros internos (PostgreSQL, Supabase, PostgREST, rede) em mensagens
 * seguras e compreensíveis em português, sem expor detalhes internos do banco.
 */
export function toPublicErrorMessage(
  err: unknown,
  fallback = "Não foi possível concluir a operação. Tente novamente em instantes."
): string {
  if (err instanceof RateLimitError) {
    return err.message;
  }

  if (err instanceof AppError) {
    if (err.message && !looksTechnical(err.message)) {
      return err.message;
    }
    return fallback;
  }

  const rawCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code || "")
      : "";
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message || "")
        : "";

  if (rawCode === "23505" || /duplicate key/i.test(rawMessage)) {
    return "Já existe um registro ativo com estes dados.";
  }

  if (rawCode === "23503") {
    return "Referência inválida ou vínculo não encontrado.";
  }

  if (rawCode === "23514") {
    return "Os dados informados não atendem às regras de validação.";
  }

  if (rawCode === "42501" || /row-level security/i.test(rawMessage)) {
    return "Você não possui permissão para executar esta operação.";
  }

  if (/rate limit|over_request_rate_limit|429/i.test(`${rawCode} ${rawMessage}`)) {
    return "Muitas solicitações realizadas em seguida. Aguarde alguns instantes antes de tentar novamente.";
  }

  if (/timeout|timed out|fetch failed|econnrefused/i.test(rawMessage)) {
    return "Serviço temporariamente indisponível. Tente novamente em instantes.";
  }

  return fallback;
}

/**
 * Extrai mapa simples campo -> primeira mensagem amigável a partir de ValidationError.
 */
export function getFieldErrorsFromError(err: unknown): Record<string, string> | undefined {
  if (!(err instanceof ValidationError)) return undefined;

  const entries = Object.entries(err.issues)
    .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
    .map(([field, messages]) => [field, messages[0]]);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

