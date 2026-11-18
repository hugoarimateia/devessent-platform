import { z } from "zod";

const PHONE_FORMAT_HINT =
  "Telefone inválido. Use DDD + número (ex.: (11) 98888-1001) ou formato internacional +5511988881001.";

function isValidPhoneValue(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (!/^[+\d()\s.-]+$/.test(trimmed)) return false;
  const normalized = trimmed.replace(/[\s().-]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(normalized);
}

export const updateTenantSettingsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Nome de exibição deve ter no mínimo 2 caracteres.")
    .max(100, "Nome de exibição não pode ultrapassar 100 caracteres."),
  contact_email: z
    .string()
    .trim()
    .email("E-mail de contato inválido.")
    .nullable()
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .trim()
    .refine(isValidPhoneValue, PHONE_FORMAT_HINT)
    .nullable()
    .optional()
    .or(z.literal("")),
  segment_label: z
    .string()
    .trim()
    .min(2, "O segmento deve ter entre 2 e 80 caracteres.")
    .max(80, "O segmento deve ter no máximo 80 caracteres.")
    .optional(),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor primária inválida (utilize formato hexadecimal #RRGGBB).")
    .optional(),
  monogram: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine(
      (v) => v === "" || /^[A-Z0-9]{1,3}$/.test(v),
      "Monograma deve conter de 1 a 3 letras maiúsculas ou números."
    )
    .nullable()
    .optional()
    .or(z.literal("")),
  brand_description: z
    .string()
    .trim()
    .max(240, "A descrição institucional deve ter no máximo 240 caracteres.")
    .nullable()
    .optional()
    .or(z.literal("")),
  timezone: z.string().default("America/Sao_Paulo"),
  locale: z.string().default("pt-BR"),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
