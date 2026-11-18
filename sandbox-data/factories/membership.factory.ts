import type { SandboxMembershipFixture } from "../fixtures/memberships";
import type { MembershipRole } from "@/types/database.types";

export class MembershipFactory {
  /**
   * Constrói dados para um vínculo de membro demonstrativo.
   */
  public static buildMembership(
    userKey: string,
    companySlug: string,
    role: MembershipRole = "staff"
  ): SandboxMembershipFixture {
    return {
      userKey,
      userEmail: `${userKey}@sandbox.devessent.test`,
      companySlug,
      role,
    };
  }
}

