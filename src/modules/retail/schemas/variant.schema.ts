import { z } from "zod";
import { VariantInvariants } from "../domain/variant-invariants";

export const variantItemSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z
    .string()
    .trim()
    .min(3, "SKU deve ter pelo menos 3 caracteres.")
    .max(48, "SKU não pode exceder 48 caracteres.")
    .transform((val) => VariantInvariants.normalizeSku(val)),
  name: z
    .string()
    .trim()
    .min(1, "Nome da variante é obrigatório.")
    .max(100, "Nome da variante não pode exceder 100 caracteres."),
  priceCents: z.coerce
    .number()
    .int("Preço deve ser um número inteiro de centavos.")
    .min(0, "O preço não pode ser negativo."),
  compareAtPriceCents: z.coerce
    .number()
    .int("Preço comparativo deve ser inteiro.")
    .min(0)
    .nullable()
    .optional(),
  stockQuantity: z.coerce
    .number()
    .int("Quantidade de estoque deve ser inteira.")
    .min(0, "Estoque não pode ser negativo.")
    .default(0),
  isAvailable: z.boolean().default(true),
  optionsSummary: z.record(z.string()).default({}),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const adjustStockSchema = z.object({
  variantId: z.string().uuid("ID da variante inválido."),
  newStockQuantity: z.coerce
    .number()
    .int("Quantidade deve ser inteira.")
    .min(0, "Estoque não pode ser negativo."),
});

export type VariantItemInput = z.infer<typeof variantItemSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

