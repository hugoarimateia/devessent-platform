import { z } from "zod";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const uploadProductImageSchema = z.object({
  productId: z.string().uuid("ID do produto inválido."),
  altText: z.string().trim().max(200, "Texto alternativo não pode exceder 200 caracteres.").nullable().optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  variantId: z.string().uuid().nullable().optional(),
});

export type UploadProductImageInput = z.infer<typeof uploadProductImageSchema>;

