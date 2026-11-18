/**
 * Gerador de tipos TypeScript diretamente do banco de dados local Supabase.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(process.cwd(), "src/types/database.types.ts");

console.log("🔄 Gerando tipos TypeScript a partir do PostgreSQL local do Supabase...");

try {
  let output = execSync("pnpm exec supabase gen types typescript", {
    encoding: "utf-8",
  });

  const helperTypes = `
// ==============================================================================
// DevEssent Platform - Tipos de Conveniência Auxiliares
// ==============================================================================
export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type TenantMembership = Database["public"]["Tables"]["tenant_memberships"]["Row"];
export type TenantSettings = Database["public"]["Tables"]["tenant_settings"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type TenantInvitation = Database["public"]["Tables"]["tenant_invitations"]["Row"];

export type TenantStatus = Database["public"]["Enums"]["tenant_status"];
export type MembershipRole = Database["public"]["Enums"]["membership_role"];
`;

  output += helperTypes;
  fs.writeFileSync(targetPath, output, "utf-8");
  const stat = fs.statSync(targetPath);
  console.log(`✅ Tipos atualizados com sucesso em src/types/database.types.ts (${stat.size} bytes).`);
} catch (error) {
  console.error("❌ Erro ao gerar tipos do banco de dados:", error);
  process.exit(1);
}
