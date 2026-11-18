import { z } from "zod";

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email("Informe um endereço de e-mail corporativo válido.")
    .transform((val) => val.toLowerCase().trim()),
  role: z.enum(["manager", "staff"], {
    errorMap: () => ({ message: "O papel deve ser 'manager' (gestor) ou 'staff' (membro)." }),
  }),
});

export const updateMemberRoleSchema = z.object({
  targetUserId: z.string().uuid("ID de usuário inválido."),
  newRole: z.enum(["manager", "staff"], {
    errorMap: () => ({ message: "O novo papel deve ser 'manager' (gestor) ou 'staff' (membro)." }),
  }),
});

export const removeMemberSchema = z.object({
  targetUserId: z.string().uuid("ID de usuário inválido."),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16, "Token de convite inválido."),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

