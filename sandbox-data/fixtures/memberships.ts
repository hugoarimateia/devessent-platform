import type { MembershipRole } from "@/types/database.types";

export interface SandboxMembershipFixture {
  userKey: string;
  userEmail: string;
  companySlug: string;
  role: MembershipRole;
}

export const sandboxMemberships: readonly SandboxMembershipFixture[] = [
  // 1. Ateliê Sandbox
  {
    userKey: "owner-atelie",
    userEmail: "owner.atelie@sandbox.devessent.test",
    companySlug: "atelier-sandbox",
    role: "owner",
  },
  {
    userKey: "manager-atelie",
    userEmail: "manager.atelie@sandbox.devessent.test",
    companySlug: "atelier-sandbox",
    role: "manager",
  },
  {
    userKey: "staff-atelie",
    userEmail: "staff.atelie@sandbox.devessent.test",
    companySlug: "atelier-sandbox",
    role: "staff",
  },
  {
    userKey: "multi-member",
    userEmail: "multi.member@sandbox.devessent.test",
    companySlug: "atelier-sandbox",
    role: "staff",
  },

  // 2. Verde Sandbox
  {
    userKey: "owner-verde",
    userEmail: "owner.verde@sandbox.devessent.test",
    companySlug: "verde-sandbox",
    role: "owner",
  },
  {
    userKey: "multi-member",
    userEmail: "multi.member@sandbox.devessent.test",
    companySlug: "verde-sandbox",
    role: "manager",
  },
] as const;

