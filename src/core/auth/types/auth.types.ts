import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarPath: string | null;
  createdAt: string;
  isPlatformAdmin: boolean;
}

export interface AuthResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

