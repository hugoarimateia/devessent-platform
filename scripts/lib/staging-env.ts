import * as fs from "fs";
import * as path from "path";

export const AUTHORIZED_STAGING_PROJECT_REF = "auebnppzxcvtaaqqlbts";
export const AUTHORIZED_STAGING_ORG_ID = "wctzfhlxtmmbvlalmuxe";
export const AUTHORIZED_STAGING_ORG_NAME = "DevEssent";
export const AUTHORIZED_STAGING_PROJECT_NAME = "dev-essent.stagging";

const FORBIDDEN_PROJECT_REFS = new Set([
  "vjoodpqjzxpmrfvjbxrq", // antigo staging preservado
  "guppedddwnuvluhiaaas", // EJCMONTESIAO
  "hhjqlkickedbnlbuxwlo", // BrokeOS
]);

export interface ValidatedStagingEnv {
  envFilePath: string;
  projectRef: string;
  supabaseUrl: string;
  supabaseHost: string;
  anonKey: string;
  serviceRoleKey: string;
  appUrl: string;
  appEnv: "staging";
  paymentEncryptionKey?: string;
  rawVars: Record<string, string>;
}

export function parseEnvFileStrict(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Arquivo de ambiente de staging não encontrado: ${filePath}\n` +
        "Crie .env.staging.local com as credenciais exclusivas do projeto autorizado (auebnppzxcvtaaqqlbts)."
    );
  }

  const vars: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf-8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

export function extractSupabaseCloudRef(rawUrl: string): { ref: string; host: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL inválida no ambiente staging.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `CONFLITO DE AMBIENTE: Staging exige HTTPS Supabase Cloud, mas recebeu protocolo "${parsed.protocol}" (${parsed.hostname}).`
    );
  }

  if (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname.endsWith(".local")
  ) {
    throw new Error(
      `CONFLITO DE AMBIENTE: NEXT_PUBLIC_SUPABASE_URL aponta para host local (${parsed.hostname}) em vez do Supabase Cloud Staging.`
    );
  }

  const match = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i);
  if (!match) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL não corresponde ao domínio oficial *.supabase.co (host: ${parsed.hostname}).`
    );
  }

  return {
    ref: match[1].toLowerCase(),
    host: parsed.hostname.toLowerCase(),
  };
}

function extractJwtProjectRef(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as { ref?: unknown; iss?: unknown };
    if (typeof payload.ref === "string" && payload.ref.length > 0) {
      return payload.ref.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyLinkedCliProjectIfPresent(projectRoot = process.cwd()): void {
  const linkedFile = path.resolve(projectRoot, "supabase/.temp/linked-project.json");
  if (!fs.existsSync(linkedFile)) return;

  try {
    const parsed = JSON.parse(fs.readFileSync(linkedFile, "utf-8")) as { ref?: string };
    const linkedRef = parsed.ref?.trim().toLowerCase();
    if (linkedRef && linkedRef !== AUTHORIZED_STAGING_PROJECT_REF) {
      throw new Error(
        `BLOQUEIO DE SEGURANÇA: A Supabase CLI local está vinculada a "${linkedRef}", mas o único staging autorizado é "${AUTHORIZED_STAGING_PROJECT_REF}".`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("BLOQUEIO DE SEGURANÇA")) {
      throw err;
    }
  }
}

export function loadAndValidateStagingEnv(options?: {
  envFile?: string;
  requireServiceRole?: boolean;
  projectRoot?: string;
}): ValidatedStagingEnv {
  const projectRoot = options?.projectRoot || process.cwd();
  const envFilePath = path.resolve(projectRoot, options?.envFile || ".env.staging.local");
  const requireServiceRole = options?.requireServiceRole ?? true;

  // Bloqueio explícito contra conflito com ambiente XAMPP já exportado no shell
  const shellMode = process.env.APP_BACKEND_MODE?.trim();
  if (shellMode && shellMode !== "supabase") {
    throw new Error(
      `CONFLITO DE AMBIENTE: O shell atual define APP_BACKEND_MODE="${shellMode}". ` +
        `O comando staging exige APP_BACKEND_MODE="supabase" sem mistura com XAMPP.`
    );
  }

  const vars = parseEnvFileStrict(envFilePath);

  const fileBackendMode = (vars.APP_BACKEND_MODE || "supabase").trim();
  if (fileBackendMode !== "supabase") {
    throw new Error(
      `CONFLITO DE AMBIENTE: .env.staging.local define APP_BACKEND_MODE="${fileBackendMode}". Apenas "supabase" é permitido.`
    );
  }

  const declaredExpectedRef = vars.DEVESSENT_EXPECTED_STAGING_PROJECT_REF?.trim().toLowerCase();
  if (declaredExpectedRef && declaredExpectedRef !== AUTHORIZED_STAGING_PROJECT_REF) {
    throw new Error(
      `BLOQUEIO DE DESTINO: DEVESSENT_EXPECTED_STAGING_PROJECT_REF="${declaredExpectedRef}" diverge do staging autorizado "${AUTHORIZED_STAGING_PROJECT_REF}".`
    );
  }

  const supabaseUrl = vars.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente em .env.staging.local.");
  }

  const { ref, host } = extractSupabaseCloudRef(supabaseUrl);

  if (FORBIDDEN_PROJECT_REFS.has(ref)) {
    throw new Error(
      `OPERAÇÃO ABORTADA: O project-ref "${ref}" pertence a um projeto preservado/proibido e não pode ser utilizado.`
    );
  }

  if (ref !== AUTHORIZED_STAGING_PROJECT_REF) {
    throw new Error(
      `OPERAÇÃO ABORTADA: Project-ref "${ref}" não autorizado. O único destino permitido para staging é "${AUTHORIZED_STAGING_PROJECT_REF}".`
    );
  }

  const anonKey = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (anonKey.length < 20) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente ou inválida em .env.staging.local.");
  }

  const anonRef = extractJwtProjectRef(anonKey);
  if (anonRef && anonRef !== AUTHORIZED_STAGING_PROJECT_REF) {
    throw new Error(
      `BLOQUEIO DE CHAVE: NEXT_PUBLIC_SUPABASE_ANON_KEY pertence ao projeto "${anonRef}", diferente de "${AUTHORIZED_STAGING_PROJECT_REF}".`
    );
  }

  const serviceRoleKey = vars.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (requireServiceRole && serviceRoleKey.length < 20) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente ou inválida em .env.staging.local.");
  }

  if (serviceRoleKey) {
    const srvRef = extractJwtProjectRef(serviceRoleKey);
    if (srvRef && srvRef !== AUTHORIZED_STAGING_PROJECT_REF) {
      throw new Error(
        `BLOQUEIO DE CHAVE: SUPABASE_SERVICE_ROLE_KEY pertence ao projeto "${srvRef}", diferente de "${AUTHORIZED_STAGING_PROJECT_REF}".`
      );
    }
  }

  verifyLinkedCliProjectIfPresent(projectRoot);

  const appUrl = vars.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  return {
    envFilePath,
    projectRef: ref,
    supabaseUrl,
    supabaseHost: host,
    anonKey,
    serviceRoleKey,
    appUrl,
    appEnv: "staging",
    paymentEncryptionKey: vars.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim() || undefined,
    rawVars: vars,
  };
}

export function buildIsolatedStagingChildEnv(
  validated: ValidatedStagingEnv,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = { ...baseEnv };

  // Remove variáveis locais/XAMPP que poderiam contaminar o ambiente staging
  const keysToStrip = [
    "DEVESSENT_BACKEND_MODE",
    "DATABASE_URL",
    "AUTHORIZED_SANDBOX_PROJECT_ID",
    "XAMPP_DB_HOST",
    "XAMPP_DB_PORT",
    "XAMPP_DB_USER",
    "XAMPP_DB_PASSWORD",
    "XAMPP_DB_NAME",
    "XAMPP_SESSION_SECRET",
    "XAMPP_STORAGE_DIR",
  ];
  for (const key of keysToStrip) {
    delete nextEnv[key];
  }

  // Injeta explicitamente no process.env para impedir sobrescrita silenciosa pelo .env.local do Next.js
  nextEnv.APP_BACKEND_MODE = "supabase";
  nextEnv.NEXT_PUBLIC_APP_ENV = "staging";
  nextEnv.NEXT_PUBLIC_APP_URL = validated.appUrl;
  nextEnv.NEXT_PUBLIC_SUPABASE_URL = validated.supabaseUrl;
  nextEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = validated.anonKey;
  nextEnv.SUPABASE_SERVICE_ROLE_KEY = validated.serviceRoleKey;
  nextEnv.DEVESSENT_EXPECTED_STAGING_PROJECT_REF = validated.projectRef;

  if (validated.paymentEncryptionKey) {
    nextEnv.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = validated.paymentEncryptionKey;
  }

  // Mitigação para timeout IPv6 de next/font/google em redes Windows
  const currentNodeOptions = nextEnv.NODE_OPTIONS?.trim() || "";
  if (!currentNodeOptions.includes("--dns-result-order=ipv4first")) {
    nextEnv.NODE_OPTIONS = currentNodeOptions
      ? `${currentNodeOptions} --dns-result-order=ipv4first`
      : "--dns-result-order=ipv4first";
  }

  return nextEnv;
}
