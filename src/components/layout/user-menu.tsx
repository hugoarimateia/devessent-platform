"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Shield, Layers } from "lucide-react";
import { logoutAction } from "@/app/actions/auth.actions";
import { ROLE_DISPLAY_MAP } from "@/lib/theme/tenant-brand";
import type { SessionUser } from "@/core/auth/types/auth.types";

interface UserMenuProps {
  user: SessionUser;
  activeRole?: string;
  hasTenants?: boolean;
  contextMode?: "platform" | "tenant";
}

export function UserMenu({
  user,
  activeRole,
  hasTenants = false,
  contextMode = "tenant",
}: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const cleanName =
    user.fullName.replace(/\s*\([^)]*\)\s*/g, "").trim() || user.fullName;

  const initials = cleanName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const roleSubtitle = user.isPlatformAdmin
    ? "Admin Global"
    : hasTenants && activeRole
    ? ROLE_DISPLAY_MAP[activeRole]?.shortLabel || activeRole
    : "Conta Autenticada";

  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isPending}
        aria-label="Menu da conta"
        aria-expanded={open}
        aria-haspopup="menu"
        title={`${cleanName} (${user.email})`}
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-xl border border-surface-border bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold shrink-0 text-white"
          style={{
            backgroundColor:
              contextMode === "tenant" && hasTenants
                ? "var(--t-fill, #5B46E5)"
                : "var(--accent, #5B46E5)",
          }}
        >
          {initials || "U"}
        </div>

        <div className="hidden md:block text-left max-w-[140px]">
          <p className="text-[12px] font-semibold text-foreground leading-none truncate">
            {cleanName}
          </p>
          <p className="text-[10px] text-foreground-muted leading-tight mt-0.5 truncate">
            {roleSubtitle}
          </p>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-foreground-muted transition-transform shrink-0 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Ações da conta"
          className="absolute right-0 mt-1.5 w-64 rounded-xl border border-surface-border bg-surface shadow-elevated p-1.5 z-50"
        >
          <div className="px-3 py-2.5 border-b border-surface-border mb-1">
            <p className="text-xs font-bold text-foreground truncate">{cleanName}</p>
            <p className="text-[11px] font-mono text-foreground-muted truncate mt-0.5">
              {user.email}
            </p>
            <p className="text-[10px] uppercase tracking-[0.1em] text-accent font-semibold mt-1">
              {roleSubtitle}
            </p>
          </div>

          {user.isPlatformAdmin && (
            <Link
              href={contextMode === "platform" ? "/dashboard" : "/admin"}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-surface-muted transition-colors"
            >
              {contextMode === "platform" ? (
                <>
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Ir para Área de Trabalho</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  <span>Abrir Console Global</span>
                </>
              )}
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isPending}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{isPending ? "Encerrando..." : "Encerrar Sessão"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
