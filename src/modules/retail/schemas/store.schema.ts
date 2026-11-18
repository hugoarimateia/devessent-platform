import { z } from "zod";
import { storefrontTemplateSchema } from "./storefront.schema";

export const STOREFRONT_DESIGN_FIELD_KEYS = [
  "template",
  "brandHeadline",
  "brandSubheadline",
  "aboutText",
  "heroBadge",
  "accentColor",
  "secondaryColor",
  "announcementBar",
] as const;

/**
 * Schema estritamente operacional gerenciável por clientes autorizados (Owner/Manager).
 * Exclui template, paleta estrutural e configuração visual do site.
 */
export const updateRetailOperationalSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "Nome da loja deve ter pelo menos 2 caracteres.")
    .max(100, "Nome da loja não pode exceder 100 caracteres."),
  currency: z
    .string()
    .trim()
    .length(3, "Moeda deve conter código de 3 letras (ex: BRL).")
    .default("BRL"),
  isActive: z.boolean().default(true),
  inventoryMode: z
    .enum(["track_quantity", "untracked"])
    .default("track_quantity"),
  contactEmail: z
    .string()
    .trim()
    .email("E-mail de contato comercial inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  socialLinks: z.record(z.string()).default({}),
});

export type UpdateRetailOperationalSettingsInput = z.input<
  typeof updateRetailOperationalSettingsSchema
>;

export const updateRetailStoreSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "Nome da loja deve ter pelo menos 2 caracteres.")
    .max(100, "Nome da loja não pode exceder 100 caracteres."),
  currency: z
    .string()
    .trim()
    .length(3, "Moeda deve conter código de 3 letras (ex: BRL).")
    .default("BRL"),
  isActive: z.boolean().default(true),
  inventoryMode: z
    .enum(["track_quantity", "untracked"])
    .default("track_quantity"),
  // Campos de Vitrine Pública (Fase 6B)
  template: storefrontTemplateSchema.default("editorial"),
  brandHeadline: z.string().trim().max(160).optional().nullable(),
  brandSubheadline: z.string().trim().max(240).optional().nullable(),
  aboutText: z.string().trim().max(1000).optional().nullable(),
  heroBadge: z.string().trim().max(60).optional().nullable(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor de destaque deve ser hexadecimal (ex: #111111).")
    .optional()
    .nullable(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor secundária deve ser hexadecimal (ex: #f4f3f0).")
    .optional()
    .nullable(),
  announcementBar: z.string().trim().max(200).optional().nullable(),
  contactEmail: z
    .string()
    .trim()
    .email("E-mail de contato comercial inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  socialLinks: z.record(z.string()).default({}),
});

export type UpdateRetailStoreInput = z.input<typeof updateRetailStoreSchema>;
