import { describe, it, expect } from "vitest";
import {
  hasPermission,
  type RoleOrAdmin,
  type PlatformOperation,
} from "@/core/permissions/policies/role-matrix";

describe("Role Matrix Policy Enforcement (Seção 12)", () => {
  describe("create_tenant", () => {
    it("deve autorizar apenas platform_admin", () => {
      expect(hasPermission("platform_admin", "create_tenant")).toBe(true);
      expect(hasPermission("owner", "create_tenant")).toBe(false);
      expect(hasPermission("manager", "create_tenant")).toBe(false);
      expect(hasPermission("staff", "create_tenant")).toBe(false);
    });
  });

  describe("manage_any_tenant", () => {
    it("deve autorizar apenas platform_admin", () => {
      expect(hasPermission("platform_admin", "manage_any_tenant")).toBe(true);
      expect(hasPermission("owner", "manage_any_tenant")).toBe(false);
      expect(hasPermission("manager", "manage_any_tenant")).toBe(false);
      expect(hasPermission("staff", "manage_any_tenant")).toBe(false);
    });
  });

  describe("view_own_tenant", () => {
    it("deve autorizar todos os papéis", () => {
      const roles: RoleOrAdmin[] = ["platform_admin", "owner", "manager", "staff"];
      for (const role of roles) {
        expect(hasPermission(role, "view_own_tenant")).toBe(true);
      }
    });
  });

  describe("update_general_settings", () => {
    it("deve autorizar platform_admin, owner e manager, mas negar staff", () => {
      expect(hasPermission("platform_admin", "update_general_settings")).toBe(true);
      expect(hasPermission("owner", "update_general_settings")).toBe(true);
      expect(hasPermission("manager", "update_general_settings")).toBe(true);
      expect(hasPermission("staff", "update_general_settings")).toBe(false);
    });
  });

  describe("manage_members", () => {
    it("deve permitir que owner gerencie qualquer membro do tenant", () => {
      expect(hasPermission("owner", "manage_members", "manager")).toBe(true);
      expect(hasPermission("owner", "manage_members", "staff")).toBe(true);
    });

    it("deve limitar manager a gerenciar apenas staff", () => {
      expect(hasPermission("manager", "manage_members", "staff")).toBe(true);
      expect(hasPermission("manager", "manage_members", "manager")).toBe(false);
      expect(hasPermission("manager", "manage_members", "owner")).toBe(false);
    });

    it("deve negar totalmente para staff", () => {
      expect(hasPermission("staff", "manage_members", "staff")).toBe(false);
    });
  });

  describe("change_owner", () => {
    it("deve bloquear no fluxo padrão para todos (requer procedimento especial)", () => {
      expect(hasPermission("platform_admin", "change_owner")).toBe(false);
      expect(hasPermission("owner", "change_owner")).toBe(false);
      expect(hasPermission("manager", "change_owner")).toBe(false);
      expect(hasPermission("staff", "change_owner")).toBe(false);
    });
  });

  describe("view_workspace", () => {
    it("deve autorizar todos os papéis para visualizar área de trabalho", () => {
      const roles: RoleOrAdmin[] = ["platform_admin", "owner", "manager", "staff"];
      for (const role of roles) {
        expect(hasPermission(role, "view_workspace")).toBe(true);
      }
    });
  });

  describe("suspend_tenant", () => {
    it("deve autorizar apenas platform_admin", () => {
      expect(hasPermission("platform_admin", "suspend_tenant")).toBe(true);
      expect(hasPermission("owner", "suspend_tenant")).toBe(false);
      expect(hasPermission("manager", "suspend_tenant")).toBe(false);
      expect(hasPermission("staff", "suspend_tenant")).toBe(false);
    });
  });
});

