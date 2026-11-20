/**
 * Instrumentação de diagnóstico de performance (desativada por padrão).
 * Ativar somente em diagnóstico definindo DEVESSENT_PERF_TRACE=1.
 * Regra estrita: nunca registrar JWTs, cookies, senhas, tokens ou PII.
 */
export function isPerfTraceEnabled(): boolean {
  return process.env.DEVESSENT_PERF_TRACE === "1";
}

export function perfNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function logPerfSpan(
  scope: string,
  span: string,
  durationMs: number,
  meta?: Record<string, string | number | boolean>
): void {
  if (!isPerfTraceEnabled()) return;
  const rounded = Math.round(durationMs * 10) / 10;
  const metaStr = meta
    ? " " +
      Object.entries(meta)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  console.log(`[PERF][${scope}] ${span}=${rounded}ms${metaStr}`);
}
