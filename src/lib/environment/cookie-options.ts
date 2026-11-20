/**
 * Determina se cookies da aplicação devem exigir o atributo `Secure`.
 *
 * - HTTPS real (Cloudflare Workers staging/produção ou qualquer domínio HTTPS): `true`.
 * - HTTP em localhost/127.0.0.1 (desenvolvimento local, `pnpm start:staging` em localhost): `false`,
 *   garantindo funcionamento consistente em testes locais sem HTTPS.
 * - Fallback em produção sem URL explícita: `true` (fail-closed).
 */
export function isSecureCookieContext(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().toLowerCase() ?? "";
  if (appUrl.startsWith("https://")) {
    return true;
  }
  if (appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) {
    return false;
  }
  return process.env.NODE_ENV === "production";
}
