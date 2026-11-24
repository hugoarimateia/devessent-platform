import { z } from "zod";

const billingCycleSchema = z.enum(["monthly", "quarterly", "semiannual", "annual"]);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.");

export const createBillingPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{1,63}$/, "Código deve conter apenas letras minúsculas, números, _ ou -."),
  name: z.string().trim().min(2, "Nome do plano obrigatório.").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  amountCents: z.number().int().positive("Valor mensal deve ser maior que zero.").max(100_000_000),
  billingCycle: billingCycleSchema.default("monthly"),
  includedServices: z.array(z.string().trim().min(1).max(120)).max(25).default([]),
  isDemo: z.boolean().default(false),
});

export const updateBillingPlanSchema = z.object({
  planId: z.string().uuid("Identificador do plano inválido."),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  amountCents: z.number().int().positive().max(100_000_000).optional(),
  billingCycle: billingCycleSchema.optional(),
  includedServices: z.array(z.string().trim().min(1).max(120)).max(25).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().trim().min(3, "Informe o motivo da alteração do plano.").max(300),
});

export const createBillingSubscriptionSchema = z.object({
  tenantId: z.string().uuid("Empresa inválida."),
  planId: z.string().uuid("Plano inválido."),
  contractedAmountCents: z.number().int().positive().max(100_000_000).optional(),
  scheduledStartDate: isoDateSchema,
  gracePeriodDays: z.number().int().min(0).max(60).default(7),
  contractAcceptedByName: z.string().trim().min(2).max(120).optional().nullable(),
  sandboxPayerEmail: z
    .string()
    .trim()
    .email("Informe um e-mail válido para o pagador Sandbox.")
    .optional()
    .nullable(),
  adminNotes: z.string().trim().max(600).optional().nullable(),
});

export const authorizeSubscriptionPaymentSchema = z.object({
  subscriptionId: z.string().uuid("Assinatura inválida."),
  paymentMethodType: z.enum(["credit_card"]).default("credit_card"),
  cardBrand: z.string().trim().min(2).max(30),
  cardLast4: z.string().trim().regex(/^[0-9]{4}$/, "Informe apenas os 4 últimos dígitos."),
  payerEmail: z.string().trim().email("E-mail do pagador inválido."),
  acceptRecurringTerms: z.literal(true, {
    errorMap: () => ({ message: "É obrigatório confirmar a autorização de cobrança recorrente." }),
  }),
  acceptedByName: z.string().trim().min(2, "Informe o nome do responsável pelo aceite.").max(120),
});

export const updateSubscriptionPaymentMethodSchema = z.object({
  subscriptionId: z.string().uuid("Assinatura inválida."),
  cardBrand: z.string().trim().min(2).max(30),
  cardLast4: z.string().trim().regex(/^[0-9]{4}$/, "Informe apenas os 4 últimos dígitos."),
});

export const updateSubscriptionContractSchema = z.object({
  subscriptionId: z.string().uuid("Assinatura inválida."),
  contractedAmountCents: z.number().int().positive().max(100_000_000).optional(),
  scheduledStartDate: isoDateSchema.optional(),
  gracePeriodDays: z.number().int().min(0).max(60).optional(),
  adminNotes: z.string().trim().max(600).optional().nullable(),
  reason: z.string().trim().min(3, "Informe o motivo da alteração contratual.").max(300),
});

export const cancelBillingSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Assinatura inválida."),
  mode: z.enum(["at_period_end", "immediate"]),
  reason: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(300),
});

export const simulateSandboxChargeSchema = z.object({
  subscriptionId: z.string().uuid("Assinatura inválida."),
  outcome: z.enum(["paid", "failed", "pending", "overdue", "refunded"]),
  billingCycleKey: z.string().trim().regex(/^\d{4}-\d{2}(-[a-z0-9-]+)?$/).optional(),
  failureReason: z.string().trim().max(240).optional(),
});

export const createImplementationContractSchema = z.object({
  tenantId: z.string().uuid("Empresa inválida."),
  title: z.string().trim().min(3, "Título do projeto obrigatório.").max(160),
  scopeSummary: z.string().trim().min(5, "Descreva o escopo contratado.").max(2000),
  totalAmountCents: z.number().int().positive("Valor total deve ser maior que zero.").max(500_000_000),
  entryPercent: z.number().int().min(0).max(100).default(50),
  entryDueDate: isoDateSchema.optional().nullable(),
  balanceDueDate: isoDateSchema.optional().nullable(),
  entryMilestone: z.string().trim().min(3).max(240).default("50% antes do início do desenvolvimento"),
  balanceMilestone: z.string().trim().min(3).max(240).default("50% na entrega e aceite do projeto"),
  customTermsNote: z.string().trim().max(500).optional().nullable(),
  acceptedByName: z.string().trim().max(120).optional().nullable(),
});

export const confirmImplementationInstallmentSchema = z.object({
  installmentId: z.string().uuid("Parcela inválida."),
  reportedPaymentMethod: z.enum([
    "pix_manual",
    "bank_transfer",
    "cash",
    "boleto_manual",
    "card_machine",
    "other",
  ]),
  confirmationNote: z.string().trim().min(3, "Informe observação ou referência do recebimento.").max(400),
});

export const updateImplementationContractActionSchema = z.object({
  contractId: z.string().uuid("Contrato inválido."),
  action: z.enum(["start_project", "confirm_delivery", "cancel", "admin_correction"]),
  note: z.string().trim().min(3, "Informe justificativa para auditoria.").max(400),
  newTotalAmountCents: z.number().int().positive().max(500_000_000).optional(),
});

export type CreateBillingPlanInput = z.infer<typeof createBillingPlanSchema>;
export type UpdateBillingPlanInput = z.infer<typeof updateBillingPlanSchema>;
export type CreateBillingSubscriptionInput = z.infer<typeof createBillingSubscriptionSchema>;
export type AuthorizeSubscriptionPaymentInput = z.infer<typeof authorizeSubscriptionPaymentSchema>;
export type UpdateSubscriptionPaymentMethodInput = z.infer<typeof updateSubscriptionPaymentMethodSchema>;
export type UpdateSubscriptionContractInput = z.infer<typeof updateSubscriptionContractSchema>;
export type CancelBillingSubscriptionInput = z.infer<typeof cancelBillingSubscriptionSchema>;
export type SimulateSandboxChargeInput = z.infer<typeof simulateSandboxChargeSchema>;
export type CreateImplementationContractInput = z.infer<typeof createImplementationContractSchema>;
export type ConfirmImplementationInstallmentInput = z.infer<typeof confirmImplementationInstallmentSchema>;
export type UpdateImplementationContractActionInput = z.infer<typeof updateImplementationContractActionSchema>;
