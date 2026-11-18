import { describe, expect, it } from "vitest";
import {
  MANAGER_VISIBLE_AUDIT_ACTIONS,
  getVisibleTenantAuditActions,
  hasPermission,
} from "@/core/permissions/policies/role-matrix";

describe("RoleMatrix — Auditoria e Permissões Fase 5B", () => {
  it("restringe view_platform_audit_logs exclusivamente a platform_admin", () => {
    expect(hasPermission("platform_admin", "view_platform_audit_logs")).toBe(true);
    expect(hasPermission("owner", "view_platform_audit_logs")).toBe(false);
    expect(hasPermission("manager", "view_platform_audit_logs")).toBe(false);
    expect(hasPermission("staff", "view_platform_audit_logs")).toBe(false);
  });

  it("concede view_tenant_audit_logs a owner, manager e platform_admin, bloqueando staff", () => {
    expect(hasPermission("platform_admin", "view_tenant_audit_logs")).toBe(true);
    expect(hasPermission("owner", "view_tenant_audit_logs")).toBe(true);
    expect(hasPermission("manager", "view_tenant_audit_logs")).toBe(true);
    expect(hasPermission("staff", "view_tenant_audit_logs")).toBe(false);
  });

  it("escopa ações visíveis em auditoria: full para owner/admin, operacional para manager e vazio para staff", () => {
    expect(getVisibleTenantAuditActions("platform_admin")).toBeNull();
    expect(getVisibleTenantAuditActions("owner")).toBeNull();

    const managerActions = getVisibleTenantAuditActions("manager");
    expect(managerActions).toEqual(MANAGER_VISIBLE_AUDIT_ACTIONS);
    expect(managerActions).toContain("tenant_settings.updated");
    expect(managerActions).toContain("invitation.created");
    expect(managerActions).toContain("member.role_updated");
    expect(managerActions).not.toContain("tenant.created");
    expect(managerActions).not.toContain("tenant.suspended");
    expect(managerActions).not.toContain("tenant.reactivated");

    expect(getVisibleTenantAuditActions("staff")).toEqual([]);
  });
});

