import * as fs from "fs";
import * as path from "path";

export interface SandboxManifestData {
  createdAt: string;
  updatedAt: string;
  projectId: string;
  tenants: Array<{ id: string; slug: string; name: string }>;
  users: Array<{ id: string; email: string; fullName: string; roleDescription: string }>;
  memberships: Array<{ id?: string; tenantId: string; userId: string; role: string }>;
  invitations: Array<{ id: string; tenantId: string; email: string; role: string }>;
}

export class SandboxManifest {
  private static manifestPath = path.resolve(process.cwd(), "sandbox-data/.sandbox-manifest.json");

  public static readonly KNOWN_SANDBOX_SLUGS = ["atelier-sandbox", "verde-sandbox"] as const;
  public static readonly SANDBOX_EMAIL_DOMAIN = "@sandbox.devessent.test";

  /**
   * Lê o arquivo de manifesto do sandbox se existir, ou retorna estrutura vazia padrão.
   */
  public static get(): SandboxManifestData {
    if (!fs.existsSync(this.manifestPath)) {
      return {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: "devessent-platform-local",
        tenants: [],
        users: [],
        memberships: [],
        invitations: [],
      };
    }

    try {
      const content = fs.readFileSync(this.manifestPath, "utf-8");
      return JSON.parse(content) as SandboxManifestData;
    } catch {
      return {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: "devessent-platform-local",
        tenants: [],
        users: [],
        memberships: [],
        invitations: [],
      };
    }
  }

  /**
   * Salva os registros rastreados no arquivo de manifesto local (ignorado pelo git).
   */
  public static save(data: Partial<SandboxManifestData>): SandboxManifestData {
    const existing = this.get();
    const updated: SandboxManifestData = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.manifestPath, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }

  /**
   * Remove o manifesto local ao realizar limpeza completa do sandbox.
   */
  public static clear(): void {
    if (fs.existsSync(this.manifestPath)) {
      fs.unlinkSync(this.manifestPath);
    }
  }

  /**
   * Verifica se um determinado slug de tenant pertence ao domínio do sandbox.
   */
  public static isSandboxSlug(slug: string): boolean {
    return this.KNOWN_SANDBOX_SLUGS.includes(slug as (typeof SandboxManifest.KNOWN_SANDBOX_SLUGS)[number]);
  }

  /**
   * Verifica se um determinado e-mail pertence ao domínio de testes do sandbox.
   */
  public static isSandboxEmail(email: string): boolean {
    return email.toLowerCase().endsWith(this.SANDBOX_EMAIL_DOMAIN);
  }
}

