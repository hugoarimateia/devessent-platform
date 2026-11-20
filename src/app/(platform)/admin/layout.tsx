import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { resolveSessionUserCached } from "@/lib/workspace/workspace-context";

/**
 * Layout persistente da Administração Global (/admin/**).
 * Mantém <AppShell contextMode="platform"> montado durante transições internas.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await resolveSessionUserCached();

  if (!sessionUser) {
    redirect("/login?redirect=/admin");
  }

  // Se o usuário não for platform_admin, bloqueia sumariamente (403 Forbidden)
  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  return (
    <AppShell user={sessionUser} contextMode="platform">
      {children}
    </AppShell>
  );
}
