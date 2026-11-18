import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface SandboxUserFixture {
  idKey: string;
  email: string;
  fullName: string;
  roleDescription: string;
  isPlatformAdmin?: boolean;
}

const CREDENTIALS_VAULT_PATH = path.resolve(
  process.cwd(),
  "sandbox-data/.credentials.local.json"
);

let runtimeGeneratedPassword: string | null = null;

/**
 * Resolve a senha de demonstração do Sandbox sem manter segredos fixos no código versionado.
 * Prioridade:
 * 1. Variável de ambiente local `SANDBOX_DEFAULT_PASSWORD`
 * 2. Cofre local não versionado `sandbox-data/.credentials.local.json`
 * 3. Geração criptográfica em tempo de execução (persistida no cofre local pelo seed)
 */
export function resolveSandboxPassword(email?: string): string {
  if (process.env.SANDBOX_DEFAULT_PASSWORD && process.env.SANDBOX_DEFAULT_PASSWORD.trim().length > 0) {
    return process.env.SANDBOX_DEFAULT_PASSWORD.trim();
  }

  if (fs.existsSync(CREDENTIALS_VAULT_PATH)) {
    try {
      const raw = fs.readFileSync(CREDENTIALS_VAULT_PATH, "utf-8");
      const parsed = JSON.parse(raw) as {
        defaultPassword?: string;
        users?: Array<{ email: string; password: string }>;
      };

      if (email && Array.isArray(parsed.users)) {
        const matched = parsed.users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (matched?.password) {
          return matched.password;
        }
      }

      if (parsed.defaultPassword) {
        return parsed.defaultPassword;
      }

      if (Array.isArray(parsed.users) && parsed.users[0]?.password) {
        return parsed.users[0].password;
      }
    } catch {
      // Fallback para geração em tempo de execução caso o arquivo local esteja corrompido
    }
  }

  if (!runtimeGeneratedPassword) {
    runtimeGeneratedPassword = `Sbx!${crypto.randomBytes(12).toString("base64url")}9#`;
  }

  return runtimeGeneratedPassword;
}

export const sandboxUsers: readonly SandboxUserFixture[] = [
  {
    idKey: "admin-global",
    email: "admin.global@sandbox.devessent.test",
    fullName: "Admin Sandbox Global",
    roleDescription: "Administrador Geral da Plataforma DevEssent",
    isPlatformAdmin: true,
  },
  {
    idKey: "owner-atelie",
    email: "owner.atelie@sandbox.devessent.test",
    fullName: "Clara Rocha (Proprietária Ateliê)",
    roleDescription: "Proprietária (Owner) do Ateliê Sandbox",
    isPlatformAdmin: false,
  },
  {
    idKey: "owner-verde",
    email: "owner.verde@sandbox.devessent.test",
    fullName: "Mateus Fontes (Proprietário Verde)",
    roleDescription: "Proprietário (Owner) do Verde Sandbox",
    isPlatformAdmin: false,
  },
  {
    idKey: "manager-atelie",
    email: "manager.atelie@sandbox.devessent.test",
    fullName: "Beatriz Lima (Gestora Ateliê)",
    roleDescription: "Gestora (Manager) do Ateliê Sandbox",
    isPlatformAdmin: false,
  },
  {
    idKey: "staff-atelie",
    email: "staff.atelie@sandbox.devessent.test",
    fullName: "Thiago Neves (Equipe Ateliê)",
    roleDescription: "Funcionário (Staff) do Ateliê Sandbox",
    isPlatformAdmin: false,
  },
  {
    idKey: "multi-member",
    email: "multi.member@sandbox.devessent.test",
    fullName: "Camila Duarte (Membro Multiempresa)",
    roleDescription: "Usuário com múltiplos vínculos (Ateliê e Verde)",
    isPlatformAdmin: false,
  },
  {
    idKey: "solo-user",
    email: "solo.user@sandbox.devessent.test",
    fullName: "Lucas Martins (Usuário Sem Empresa)",
    roleDescription: "Usuário autenticado sem vínculos com nenhum estabelecimento",
    isPlatformAdmin: false,
  },
] as const;

