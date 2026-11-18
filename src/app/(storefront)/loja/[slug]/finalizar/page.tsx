import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailStorefrontService,
  StorefrontCheckoutClient,
  StorefrontLayoutResolver,
  resolveActiveTemplate,
  resolveAuthorizedPreviewTemplate,
} from "@/modules/retail";

export const dynamic = "force-dynamic";

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview_template?: string }>;
}

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const store = await RetailStorefrontService.getPublicStore(supabase, slug);

  if (!store) {
    return {
      title: "Solicitação de Pedido",
      robots: { index: false, follow: false, nocache: true },
    };
  }

  return {
    title: `Finalizar Solicitação | ${store.storeName}`,
    description: `Envie sua solicitação de pedido para ${store.storeName}. Sem cobrança online.`,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function StorefrontCheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const { slug } = await params;
  const { preview_template } = await searchParams;

  const supabase = await createClient();
  const [store, previewTemplate] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  const categories = await RetailStorefrontService.getPublicCategories(supabase, store.tenantId);
  const activeTemplate = resolveActiveTemplate(store.template, previewTemplate);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontCheckoutClient
        store={store}
        template={activeTemplate}
        previewTemplate={previewTemplate}
      />
    </StorefrontLayoutResolver>
  );
}
