import { z } from "zod";

export const cartItemInputSchema = z.object({
  productId: z.string().uuid("Produto inválido."),
  variantId: z.string().uuid("Variante inválida."),
  quantity: z
    .number()
    .int("Quantidade deve ser um número inteiro.")
    .min(1, "Quantidade mínima é 1.")
    .max(99, "Quantidade máxima por item é 99."),
});

export const cartUpdateQuantitySchema = z.object({
  variantId: z.string().uuid("Variante inválida."),
  quantity: z
    .number()
    .int("Quantidade deve ser um número inteiro.")
    .min(0, "Quantidade não pode ser negativa.")
    .max(99, "Quantidade máxima por item é 99."),
});

export const createPublicOrderSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo (mínimo 2 caracteres).")
      .max(120, "Nome não pode exceder 120 caracteres."),
    customerPhone: z
      .string()
      .trim()
      .min(8, "Informe um telefone ou WhatsApp válido com DDD.")
      .max(30, "Telefone não pode exceder 30 caracteres.")
      .refine((val) => val.replace(/\D/g, "").length >= 10, {
        message: "Informe DDD + número com pelo menos 10 dígitos.",
      }),
    customerEmail: z
      .string()
      .trim()
      .email("Informe um e-mail válido ou deixe o campo em branco.")
      .max(180)
      .optional()
      .or(z.literal("")),
    deliveryMode: z.enum(["pickup", "delivery"], {
      errorMap: () => ({ message: "Selecione entre retirada na loja ou entrega." }),
    }),
    deliveryAddress: z
      .string()
      .trim()
      .max(400, "Endereço não pode exceder 400 caracteres.")
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(500, "Observações não podem exceder 500 caracteres.")
      .optional()
      .or(z.literal("")),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "delivery" && (!data.deliveryAddress || data.deliveryAddress.trim().length < 6)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveryAddress"],
        message: "Para entrega, informe o endereço completo (rua, número e bairro/cidade).",
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  nextStatus: z.enum(["requested", "confirmed", "preparing", "ready", "completed", "cancelled"]),
  reason: z
    .string()
    .trim()
    .max(400, "Justificativa não pode exceder 400 caracteres.")
    .optional(),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CartUpdateQuantityInput = z.infer<typeof cartUpdateQuantitySchema>;
export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
