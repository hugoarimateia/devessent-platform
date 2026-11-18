import * as React from "react";
import { Crown, Briefcase, UserCheck, Shield } from "lucide-react";
import { ROLE_DISPLAY_MAP } from "@/lib/theme/tenant-brand";

interface RoleBadgeProps {
  role: string;
  showPrefix?: boolean;
}

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-accent/10 text-accent border-accent/25",
  manager: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  staff: "bg-surface-muted text-foreground-muted border-surface-border",
  platform_admin: "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25",
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  manager: Briefcase,
  staff: UserCheck,
  platform_admin: Shield,
};

export function RoleBadge({ role, showPrefix = false }: RoleBadgeProps) {
  const info = ROLE_DISPLAY_MAP[role] || { label: role, shortLabel: role };
  const classes = ROLE_STYLES[role] || ROLE_STYLES.staff;
  const Icon = ROLE_ICONS[role] || UserCheck;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[12px] font-semibold border leading-snug ${classes}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{showPrefix ? `Papel: ${info.label}` : info.label}</span>
    </span>
  );
}
