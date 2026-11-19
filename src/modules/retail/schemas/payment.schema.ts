import { z } from "zod";

export const connectPaymentAccountSchema = z.object({
  tenantId: z.string().uuid("Identificador de empresa inválido."),
  provider: z.enum(["mercado_pago", "xampp_sandbox"], {
    errorMap: () => ({ message: "Provedor de pagamento inválido." }),
  }),
  environment: z.literal("sandbox", {
    errorMap: () => ({
      message: "FAIL-CLOSED: Apenas o ambiente 'sandbox' é permitido nesta fase.",
    }),
  }),
  sellerAccountId: z
    .string()
    .trim()
    .min(3, "O identificador da conta recebedora do vendedor é obrigatório.")
    .max(120, "Identificador da conta recebedora muito longo.")
    .regex(/^[A-Za-z0-9_.-]+$/, "Identificador da conta recebedora contém caracteres inválidos."),
  sellerAccountLabel: z
    .string()
    .trim()
    .min(3, "Informe um rótulo comercial para identificar a conta recebedora.")
    .max(160, "Rótulo comercial muito longo."),
  accessToken: z
    .string()
    .trim()
    .min(12, "Token de acesso sandbox do vendedor é obrigatório.")
    .max(512)
    .refine(
      (val) => !/^(APP_USR_LIVE_|LIVE_|PROD_)/i.test(val),
      "FAIL-CLOSED: Tokens de produção (live) são proibidos no ambiente de homologação."
    ),
  refreshToken: z.string().trim().max(512).optional().nullable(),
  webhookSecret: z
    .string()
    .trim()
    .min(12, "Segredo de assinatura de webhook é obrigatório.")
    .max(256),
  publicKey: z.string().trim().max(255).optional().nullable(),
});

export const setOrderShippingFeeSchema = z.object({
  orderId: z.string().uuid("Identificador do pedido inválido."),
  shippingFeeCents: z
    .number()
    .int("O valor do frete deve ser informado em centavos inteiros.")
    .min(0, "O valor do frete não pode ser negativo.")
    .max(5_000_000, "O valor do frete excede o limite permitido."),
});

export const initiatePaymentSessionSchema = z.object({
  orderId: z.string().uuid("Identificador do pedido inválido."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Chave de idempotência inválida.")
    .max(128)
    .regex(/^[A-Za-z0-9_:-]+$/, "Formato inválido de chave de idempotência."),
});

export const requestPaymentRefundSchema = z.object({
  paymentId: z.string().uuid("Identificador do pagamento inválido."),
  refundAmountCents: z
    .number()
    .int("O valor do reembolso deve ser em centavos inteiros.")
    .positive("O valor do reembolso deve ser maior que zero.")
    .optional(),
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo do reembolso.")
    .max(240, "O motivo do reembolso deve ter no máximo 240 caracteres."),
});

export type ConnectPaymentAccountInput = z.infer<typeof connectPaymentAccountSchema>;
export type SetOrderShippingFeeInput = z.infer<typeof setOrderShippingFeeSchema>;
export type InitiatePaymentSessionInput = z.infer<typeof initiatePaymentSessionSchema>;
export type RequestPaymentRefundInput = z.infer<typeof requestPaymentRefundSchema>;
