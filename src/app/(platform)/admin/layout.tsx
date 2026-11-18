import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  if (!sessionUser) {
    redirect("/login?redirect=/admin");
  }

  // Se o usuário não for platform_admin, bloqueia sumariamente (403 Forbidden)
  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  return <>{children}</>;
}

