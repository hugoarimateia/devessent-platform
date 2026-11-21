import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSessionUserCached } from "@/lib/workspace/workspace-context";
import { BillingSubscriptionService } from "@/modules/billing";
import { AdminBillingConsole } from "@/modules/billing/components/admin-billing-console";

export const metadata: Metadata = {
  title: "Comercial & Assinaturas | DevEssent Admin",
  description:
    "Gestão exclusiva de planos SaaS, assinaturas recorrentes, mensalidades e contratos de implantação 50/50 da DevEssent.",
};

export const dynamic = "force-dynamic";

export default async function AdminComercialPage() {
  const [sessionUser, supabase] = await Promise.all([
    resolveSessionUserCached(),
    createClient(),
  ]);

  if (!sessionUser) {
    redirect("/login?redirect=/admin/comercial");
  }

  if (!sessionUser.isPlatformAdmin) {
    redirect("/forbidden");
  }

  const overview = await BillingSubscriptionService.getGlobalBillingOverview({
    supabase,
    actorRole: "platform_admin",
  });

  return <AdminBillingConsole overview={overview} />;
}
