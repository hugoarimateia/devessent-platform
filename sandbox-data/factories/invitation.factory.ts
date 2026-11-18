import type { SandboxInvitationFixture } from "../fixtures/invitations";
import type { MembershipRole } from "@/types/database.types";

export class InvitationFactory {
  /**
   * Constrói dados para um convite demonstrativo.
   */
  public static buildInvitation(
    companySlug: string,
    invitedByKey: string,
    role: MembershipRole = "staff",
    scenario: "pending" | "expired" | "revoked" = "pending"
  ): SandboxInvitationFixture {
    const timestamp = Date.now();
    return {
      companySlug,
      email: `convidado-${scenario}-${timestamp}@sandbox.devessent.test`,
      role,
      statusScenario: scenario,
      invitedByKey,
    };
  }
}

