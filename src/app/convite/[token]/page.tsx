import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AuthService } from "@/core/auth/services/auth-service";
import { InvitationService } from "@/core/tenants";
import { AcceptInvitationCard } from "@/components/auth/accept-invitation-card";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Convite de Estabelecimento | DevEssent Platform",
  description: "Aceitação de convite corporativo na DevEssent Platform.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

interface ConvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function ConvitePage({ params }: ConvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();
  const sessionUser = await AuthService.getSessionUser(supabase);

  let inviteData: Awaited<ReturnType<typeof InvitationService.getInvitationByToken>> | null = null;
  let notFound = false;

  try {
    inviteData = await InvitationService.getInvitationByToken(supabase, token);
  } catch {
    notFound = true;
  }

  return (
    <div className="min-h-[100svh] bg-surface dark:bg-[#0B0D14] text-foreground flex flex-col">
      <header className="w-full px-6 sm:px-10 h-16 flex items-center justify-between border-b border-surface-border">
        <BrandLogo size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {notFound || !inviteData ? (
          <div className="max-w-md w-full rounded-xl border border-surface-border bg-surface overflow-hidden">
            <div className="h-[3px] w-full bg-red-600 dark:bg-red-500" />
            <div className="p-8 space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
                Convite Indisponível
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Convite Inválido
              </h1>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Este link de convite não foi encontrado ou não é mais válido no sistema. Verifique o endereço recebido ou solicite novo convite ao gestor do estabelecimento.
              </p>
            </div>
          </div>
        ) : (
          <AcceptInvitationCard
            token={token}
            tenantName={inviteData.tenantName}
            tenantStatus={inviteData.tenantStatus}
            role={inviteData.role}
            email={inviteData.email}
            status={inviteData.status}
            isExpired={inviteData.isExpired}
            currentUserEmail={sessionUser?.email}
            isLoggedIn={Boolean(sessionUser)}
          />
        )}
      </main>
    </div>
  );
}
