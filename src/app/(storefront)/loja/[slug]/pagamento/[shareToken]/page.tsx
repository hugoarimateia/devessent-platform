import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailPaymentService,
  RetailStorefrontService,
  StorefrontLayoutResolver,
  StorefrontPaymentShareView,
  resolveActiveTemplate,
  resolveAuthorizedPreviewTemplate,
} from "@/modules/retail";

export const dynamic = "force-dynamic";

interface PaymentSharePageProps {
  params: Promise<{ slug: string; shareToken: string }>;
  searchParams: Promise<{
    preview_template?: string;
    sandbox_checkout?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PaymentSharePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const store = await RetailStorefrontService.getPublicStore(supabase, slug);

  return {
    title: store
      ? `Checkout de Pagamento | ${store.storeName}`
      : "Pagamento não encontrado",
    description: "Checkout seguro de pagamento vinculado ao pedido confirmado.",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function StorefrontPaymentSharePage({
  params,
  searchParams,
}: PaymentSharePageProps) {
  const { slug, shareToken } = await params;
  const { preview_template, sandbox_checkout } = await searchParams;

  const supabase = await createClient();
  const [store, previewTemplate, shareView] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    resolveAuthorizedPreviewTemplate(supabase, preview_template),
    RetailPaymentService.getPublicPaymentShareView({
      storeSlug: slug,
      shareToken,
    }),
  ]);

  if (!store || !store.isActive || !shareView) {
    notFound();
  }

  const categories = await RetailStorefrontService.getPublicCategories(
    supabase,
    store.tenantId
  );
  const activeTemplate = resolveActiveTemplate(store.template, previewTemplate);

  return (
    <StorefrontLayoutResolver
      store={store}
      categories={categories}
      previewTemplate={previewTemplate}
    >
      <StorefrontPaymentShareView
        shareView={shareView}
        shareToken={shareToken}
        template={activeTemplate}
        previewTemplate={previewTemplate}
        initialSandboxOpen={sandbox_checkout === "1"}
      />
    </StorefrontLayoutResolver>
  );
}
