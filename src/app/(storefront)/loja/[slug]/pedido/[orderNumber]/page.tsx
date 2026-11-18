import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailOrderService,
  RetailStorefrontService,
  StorefrontLayoutResolver,
  StorefrontOrderReceipt,
  resolveActiveTemplate,
  resolveAuthorizedPreviewTemplate,
} from "@/modules/retail";
import { readStoreOrderReceiptToken } from "@/modules/retail/services/retail-cart-cookie";

export const dynamic = "force-dynamic";

interface OrderReceiptPageProps {
  params: Promise<{ slug: string; orderNumber: string }>;
  searchParams: Promise<{ preview_template?: string }>;
}

export async function generateMetadata({
  params,
}: OrderReceiptPageProps): Promise<Metadata> {
  const { slug, orderNumber } = await params;
  const supabase = await createClient();
  const store = await RetailStorefrontService.getPublicStore(supabase, slug);

  if (!store) {
    return {
      title: "Pedido não encontrado",
      robots: { index: false, follow: false, nocache: true },
    };
  }

  return {
    title: `Pedido ${orderNumber} | ${store.storeName}`,
    description: `Comprovante de solicitação do pedido ${orderNumber} em ${store.storeName}.`,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function StorefrontOrderReceiptPage({
  params,
  searchParams,
}: OrderReceiptPageProps) {
  const { slug, orderNumber } = await params;
  const { preview_template } = await searchParams;
  const publicToken = await readStoreOrderReceiptToken(slug, orderNumber);

  const supabase = await createClient();
  const [store, previewTemplate] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  const [categories, trackedOrder] = await Promise.all([
    RetailStorefrontService.getPublicCategories(supabase, store.tenantId),
    publicToken
      ? RetailOrderService.getPublicOrderTracking({
          storeSlug: slug,
          orderNumber,
          publicToken,
        })
      : Promise.resolve(null),
  ]);

  if (!trackedOrder) {
    notFound();
  }

  const activeTemplate = resolveActiveTemplate(store.template, previewTemplate);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontOrderReceipt
        order={trackedOrder}
        template={activeTemplate}
        previewTemplate={previewTemplate}
      />
    </StorefrontLayoutResolver>
  );
}
