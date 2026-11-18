import type {
  PublicStorefront,
  RetailCategory,
  RetailProductWithDetails,
  StorefrontTemplate,
  StorefrontSortOption,
} from "../../types/retail.types";

export interface StorefrontLayoutProps {
  store: PublicStorefront;
  categories: RetailCategory[];
  children: React.ReactNode;
  previewTemplate?: StorefrontTemplate;
}

export interface StorefrontHomeProps {
  store: PublicStorefront;
  categories: RetailCategory[];
  featuredProducts: RetailProductWithDetails[];
  previewTemplate?: StorefrontTemplate;
}

export interface StorefrontCatalogProps {
  store: PublicStorefront;
  categories: RetailCategory[];
  products: RetailProductWithDetails[];
  totalCount: number;
  page: number;
  totalPages: number;
  activeCategorySlug?: string;
  search?: string;
  sort?: StorefrontSortOption;
  previewTemplate?: StorefrontTemplate;
}

export interface StorefrontProductProps {
  store: PublicStorefront;
  product: RetailProductWithDetails;
  relatedProducts: RetailProductWithDetails[];
  previewTemplate?: StorefrontTemplate;
}

