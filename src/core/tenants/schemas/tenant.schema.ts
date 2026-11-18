import { z } from "zod";

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "settings",
  "dashboard",
  "forbidden",
  "app",
  "core",
  "platform",
  "system",
  "health",
  "devessent",
  "public",
  "static",
  "assets",
  "favicon",
] as const;

export const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(3, "O identificador deve conter no mínimo 3 caracteres.")
  .max(50, "O identificador não pode ultrapassar 50 caracteres.")
  .regex(
    slugRegex,
    "O identificador deve conter apenas letras minúsculas, números e hífens isolados (ex: minha-empresa)."
  )
  .refine(
    (slug) => !RESERVED_SLUGS.includes(slug.toLowerCase() as (typeof RESERVED_SLUGS)[number]),
    {
      message: "Este identificador é reservado pelo sistema e não pode ser utilizado.",
    }
  );

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, "O nome do estabelecimento deve ter no mínimo 2 caracteres.")
    .max(100, "O nome do estabelecimento não pode ultrapassar 100 caracteres.")
    .trim(),
  slug: slugSchema,
  ownerEmail: z.string().email("E-mail do proprietário inválido."),
  ownerFullName: z.string().min(2, "Nome do proprietário deve ter no mínimo 2 caracteres.").trim(),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;

