import { z } from "zod";
import { ProductInvariants } from "../domain/product-invariants";

export const createCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nome da categoria deve ter pelo menos 2 caracteres.")
      .max(80, "Nome da categoria não pode exceder 80 caracteres."),
    slug: z.string().trim().max(80).optional(),
    description: z
      .string()
      .trim()
      .max(500, "A descrição não pode exceder 500 caracteres.")
      .nullable()
      .optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .transform((data) => ({
    ...data,
    slug:
      data.slug && data.slug.length > 0
        ? ProductInvariants.slugify(data.slug)
        : ProductInvariants.slugify(data.name),
  }));

export const updateCategorySchema = z
  .object({
    id: z.string().uuid("ID de categoria inválido."),
    name: z
      .string()
      .trim()
      .min(2, "Nome da categoria deve ter pelo menos 2 caracteres.")
      .max(80, "Nome da categoria não pode exceder 80 caracteres.")
      .optional(),
    slug: z.string().trim().max(80).optional(),
    description: z
      .string()
      .trim()
      .max(500, "A descrição não pode exceder 500 caracteres.")
      .nullable()
      .optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
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

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CreateCategoryOutput = z.output<typeof createCategorySchema>;
export type UpdateCategoryOutput = z.output<typeof updateCategorySchema>;

