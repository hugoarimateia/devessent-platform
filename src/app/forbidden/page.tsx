import { AccessDeniedState } from "@/components/ui/access-denied-state";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function ForbiddenPage() {
  return (
    <div className="min-h-[100svh] bg-surface dark:bg-[#0B0D14] text-foreground flex flex-col">
      <header className="w-full px-6 sm:px-10 h-16 flex items-center justify-between border-b border-surface-border">
        <BrandLogo size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <AccessDeniedState returnHref="/" returnLabel="Retornar ao início" />
      </main>
    </div>
  );
}
