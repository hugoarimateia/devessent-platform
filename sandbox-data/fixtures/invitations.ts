import type { MembershipRole } from "@/types/database.types";

export interface SandboxInvitationFixture {
  companySlug: string;
  email: string;
  role: MembershipRole;
  statusScenario: "pending" | "expired" | "revoked";
  invitedByKey: string;
}

export const sandboxInvitations: readonly SandboxInvitationFixture[] = [
  {
    companySlug: "atelier-sandbox",
    email: "convidado.pendente@sandbox.devessent.test",
    role: "staff",
    statusScenario: "pending",
    invitedByKey: "owner-atelie",
  },
  {
    companySlug: "atelier-sandbox",
    email: "convidado.expirado@sandbox.devessent.test",
    role: "staff",
    statusScenario: "expired",
    invitedByKey: "owner-atelie",
  },
  {
    companySlug: "atelier-sandbox",
    email: "convidado.revogado@sandbox.devessent.test",
    role: "staff",
    statusScenario: "revoked",
    invitedByKey: "owner-atelie",
  },
] as const;

