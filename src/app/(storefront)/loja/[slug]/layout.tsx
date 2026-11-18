import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RetailCartService,
  RetailStorefrontService,
  StorefrontCartProvider,
} from "@/modules/retail";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const store = await RetailStorefrontService.getPublicStore(supabase, slug);

  if (!store) {
    return {
      title: "Loja Não Encontrada | DevEssent Retail",
      description: "A vitrine solicitada não existe ou está temporariamente inativa.",
    };
  }

  return {
    title: `${store.storeName} | Vitrine Oficial`,
    description:
      store.brandSubheadline ||
      store.brandHeadline ||
      store.aboutText ||
      "Vitrine comercial desenvolvida na DevEssent Platform.",
    openGraph: {
      title: store.storeName,
      description: store.brandHeadline || "Coleções autorais e catálogo comercial.",
      type: "website",
    },
  };
}

export default async function StorefrontRootLayout({
  children,
  params,
}: StorefrontLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const [store, initialCart] = await Promise.all([
    RetailStorefrontService.getPublicStore(supabase, slug),
    RetailCartService.getCartForStore(slug),
  ]);

  if (!store || !store.isActive) {
    notFound();
  }

  return (
    <StorefrontCartProvider
      storeSlug={store.slug}
      initialTemplate={store.template}
      initialCart={initialCart}
    >
      {children}
    </StorefrontCartProvider>
  );
}

