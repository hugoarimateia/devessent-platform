import { z } from "zod";
import { ProductInvariants } from "../domain/product-invariants";
import { variantItemSchema } from "./variant.schema";

export const productOptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome do atributo/opção é obrigatório.").max(50),
  position: z.coerce.number().int().min(0).default(0),
  values: z.array(z.string().trim().min(1)).min(1, "Cada opção deve ter pelo menos um valor."),
});

export const createProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nome do produto deve ter pelo menos 2 caracteres.")
      .max(120, "Nome do produto não pode exceder 120 caracteres."),
    slug: z.string().trim().max(120).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    categoryIds: z.array(z.string().uuid()).default([]),
    options: z.array(productOptionSchema).default([]),
    variants: z
      .array(variantItemSchema)
      .min(1, "O produto deve conter pelo menos uma variante (ex.: Padrão)."),
  })
  .transform((data) => ({
    ...data,
    slug:
      data.slug && data.slug.length > 0
        ? ProductInvariants.slugify(data.slug)
        : ProductInvariants.slugify(data.name),
  }));

export const updateProductSchema = z
  .object({
    id: z.string().uuid("ID do produto inválido."),
    name: z
      .string()
      .trim()
      .min(2, "Nome do produto deve ter pelo menos 2 caracteres.")
      .max(120, "Nome do produto não pode exceder 120 caracteres.")
      .optional(),
    slug: z.string().trim().max(120).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    options: z.array(productOptionSchema).optional(),
    variants: z.array(variantItemSchema).optional(),
  })
  .transform((data) => ({
    ...data,
    slug:
      data.slug !== undefined && data.slug.length > 0
        ? ProductInvariants.slugify(data.slug)
        : data.name
        ? ProductInvariants.slugify(data.name)
        : undefined,
  }));

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type CreateProductOutput = z.output<typeof createProductSchema>;
export type UpdateProductOutput = z.output<typeof updateProductSchema>;

