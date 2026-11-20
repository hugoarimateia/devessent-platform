import * as fs from "fs";
import * as path from "path";

export const AUTHORIZED_STAGING_PROJECT_REF = "auebnppzxcvtaaqqlbts";

const FORBIDDEN_PROJECT_REFS = new Set([
  "vjoodpqjzxpmrfvjbxrq", // antigo staging
  "guppedddwnuvluhiaaas", // EJCMONTESIAO
  "hhjqlkickedbnlbuxwlo", // BrokeOS
]);

export interface ScannerServerConfig {
  env: "staging";
  supabaseUrl: string;
  supabaseHost: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  allowedUserIds: string[];
  allowedEmails: string[];
  sessionSecret: string;
  openLookupMode: "disabled" | "openfoodfacts";
  allowedImageHosts: string[];
}

let cachedFileVars: Record<string, string> | null = null;

function readScannerEnvFile(): Record<string, string> {
  if (cachedFileVars) return cachedFileVars;
  const candidate = path.resolve(process.cwd(), ".env.scanner.local");
  const out: Record<string, string> = {};
  if (fs.existsSync(candidate)) {
    for (const raw of fs.readFileSync(candidate, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      out[line.slice(0, eq).trim()] = line
        .slice(eq + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  cachedFileVars = out;
  return out;
}

function getVar(name: string): string {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const fromFile = readScannerEnvFile()[name]?.trim();
  return fromFile || "";
}

export function resetScannerConfigCacheForTests(): void {
  cachedFileVars = null;
}

/**
 * Carrega e valida estritamente a configuração privativa do DevEssent Catalog Scanner.
 * Fail-closed: recusa projeto não autorizado, falta de allowlist de proprietário ou segredo de sessão fraco.
 */
export function getScannerServerConfig(): ScannerServerConfig {
  if (typeof window !== "undefined") {
    throw new Error(
      "VIOLAÇÃO DE SEGURANÇA: getScannerServerConfig() é exclusivo do servidor."
    );
  }

  const supabaseUrl = getVar("SUPABASE_URL") || getVar("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey =
    getVar("SUPABASE_ANON_KEY") || getVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = getVar("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL não configurada no DevEssent Catalog Scanner.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL inválida no DevEssent Catalog Scanner.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("BLOQUEIO DE SEGURANÇA: SUPABASE_URL deve usar HTTPS.");
  }

  const refMatch = parsedUrl.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i);
  const projectRef = refMatch?.[1]?.toLowerCase() ?? "";
  if (FORBIDDEN_PROJECT_REFS.has(projectRef) || projectRef !== AUTHORIZED_STAGING_PROJECT_REF) {
    throw new Error(
      `BLOQUEIO DE SEGURANÇA (Fail-Closed): projeto Supabase '${projectRef || parsedUrl.hostname}' não autorizado. Apenas o Staging '${AUTHORIZED_STAGING_PROJECT_REF}' é permitido nesta fase.`
    );
  }

  if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
    throw new Error("SUPABASE_ANON_KEY ausente ou inválida.");
  }
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.length < 20) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente ou inválida.");
  }

  const allowedUserIds = getVar("CATALOG_SCANNER_ALLOWED_USER_IDS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f-]{36}$/.test(s));

  if (allowedUserIds.length === 0) {
    throw new Error(
      "BLOQUEIO DE SEGURANÇA (Fail-Closed): CATALOG_SCANNER_ALLOWED_USER_IDS vazio ou inválido. Nenhum usuário está autorizado."
    );
  }

  const allowedEmails = getVar("CATALOG_SCANNER_ALLOWED_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const sessionSecret = getVar("CATALOG_SCANNER_SESSION_SECRET");
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "BLOQUEIO DE SEGURANÇA (Fail-Closed): CATALOG_SCANNER_SESSION_SECRET deve ter pelo menos 32 caracteres."
    );
  }

  const rawOpenLookup = getVar("CATALOG_SCANNER_OPEN_LOOKUP").toLowerCase();
  const openLookupMode: "disabled" | "openfoodfacts" =
    rawOpenLookup === "openfoodfacts" ? "openfoodfacts" : "disabled";

  const allowedImageHosts = getVar("CATALOG_SCANNER_ALLOWED_IMAGE_HOSTS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    env: "staging",
    supabaseUrl,
    supabaseHost: parsedUrl.hostname.toLowerCase(),
    supabaseAnonKey,
    supabaseServiceRoleKey,
    allowedUserIds,
    allowedEmails,
    sessionSecret,
    openLookupMode,
    allowedImageHosts,
  };
}
