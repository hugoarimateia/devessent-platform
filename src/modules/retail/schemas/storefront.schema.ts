import { z } from "zod";

export const storefrontTemplateSchema = z.enum(["editorial", "experimental"]);

export const storefrontSettingsSchema = z.object({
  template: storefrontTemplateSchema.default("editorial"),
  brandHeadline: z
    .string()
    .trim()
    .max(160, "Headline da marca não pode exceder 160 caracteres.")
    .optional()
    .nullable(),
  brandSubheadline: z
    .string()
    .trim()
    .max(240, "Subtítulo da marca não pode exceder 240 caracteres.")
    .optional()
    .nullable(),
  aboutText: z
    .string()
    .trim()
    .max(1000, "Texto sobre a marca não pode exceder 1000 caracteres.")
    .optional()
    .nullable(),
  heroBadge: z
    .string()
    .trim()
    .max(60, "Badge do hero não pode exceder 60 caracteres.")
    .optional()
    .nullable(),
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
  announcementBar: z
    .string()
    .trim()
    .max(200, "Texto da barra de anúncios não pode exceder 200 caracteres.")
    .optional()
    .nullable(),
  contactEmail: z
    .string()
    .trim()
    .email("E-mail de contato comercial inválido.")
    .optional()
    .nullable()
    .or(z.literal("")),
  contactPhone: z
    .string()
    .trim()
    .max(40, "Telefone de contato não pode exceder 40 caracteres.")
    .optional()
    .nullable(),
  socialLinks: z.record(z.string()).default({}),
});

export type StorefrontSettingsInput = z.infer<typeof storefrontSettingsSchema>;

