import type { SandboxUserFixture } from "../fixtures/users";

export class UserFactory {
  /**
   * Constrói dados para um usuário de demonstração.
   */
  public static buildUser(overrides: Partial<SandboxUserFixture> = {}): SandboxUserFixture {
    const idKey = overrides.idKey || `user-${Date.now()}`;
    const email = overrides.email || `${idKey}@sandbox.devessent.test`;
    const fullName = overrides.fullName || `Usuário Demonstração ${idKey}`;
    const roleDescription = overrides.roleDescription || "Membro de Teste";
    const isPlatformAdmin = overrides.isPlatformAdmin ?? false;

    return {
      idKey,
      email,
      fullName,
      roleDescription,
      isPlatformAdmin,
    };
  }

  /**
   * Constrói múltiplos usuários sintéticos para testes de carga ou amostragem.
   */
  public static buildMany(count: number, prefix = "demo"): SandboxUserFixture[] {
    return Array.from({ length: count }, (_, i) =>
      this.buildUser({
        idKey: `${prefix}-${i + 1}`,
        email: `${prefix}.${i + 1}@sandbox.devessent.test`,
        fullName: `Usuário Sintético ${i + 1}`,
        roleDescription: `Colaborador Sintético ${i + 1}`,
        isPlatformAdmin: false,
      })
    );
  }
}

