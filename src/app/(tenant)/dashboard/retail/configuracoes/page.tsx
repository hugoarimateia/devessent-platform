import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceSession } from "@/lib/workspace/workspace-context";
import { RetailStoreService } from "@/modules/retail/services/retail-store-service";
import { RetailSettingsForm } from "@/modules/retail/components/retail-settings-form";

export const metadata: Metadata = {
  title: "Configurações da Loja | DevEssent Retail",
  description: "Parâmetros comerciais, moeda e controle de estoque.",
};

export default async function RetailConfiguracoesPage() {
  const workspace = await resolveWorkspaceSession();

  if (!workspace.sessionUser) {
    redirect("/login?redirect=/dashboard/retail/configuracoes");
  }

  if (workspace.isSuspended) {
    return null;
  }

  const { activeContext } = workspace;
  if (!activeContext) {
    redirect("/dashboard");
  }

  // Reutiliza loja já obtida no bootstrap consolidado; só inicializa se ainda não existir
  let store = workspace.activeRetailStore;
  if (!store) {
    const supabase = await createClient();
    store = await RetailStoreService.ensureStore(
      supabase,
      activeContext.tenantId,
      `Loja ${activeContext.tenantName}`
    );
  }

  return (
    <RetailSettingsForm
      tenantId={activeContext.tenantId}
      store={store}
      userRole={activeContext.role}
    />
  );
}
