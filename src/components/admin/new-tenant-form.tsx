"use client";

import * as React from "react";
import Link from "next/link";
import { Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTenantAction,
  type TenantActionState,
} from "@/app/actions/tenant.actions";

export function NewTenantForm() {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [ownerFullName, setOwnerFullName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [state, formAction, isPending] = React.useActionState<
    TenantActionState | null,
    FormData
  >(createTenantAction, null);

  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.success && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro no cadastro</p>
            <p className="mt-0.5 opacity-90">{state.error}</p>
            {state.fieldErrors && (
              <ul className="mt-2 list-disc list-inside space-y-1">
                {Object.entries(state.fieldErrors).map(([field, errs]) => (
                  <li key={field}>
                    <strong>{field}:</strong> {errs.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-surface-border bg-surface overflow-hidden divide-y divide-surface-border">
        {/* Seção 01 */}
        <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              01 · Unidade
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Dados do Estabelecimento
            </h2>
            <p className="text-xs text-foreground-muted leading-relaxed">
              Identificação institucional e slug canônico único na plataforma.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div>
              <Label htmlFor="name" required>
                Nome do Estabelecimento
              </Label>
              <Input
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Verde Floricultura"
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="slug" required>
                Slug Público (Identificador Único)
              </Label>
              <Input
                id="slug"
                name="slug"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="verde-floricultura"
                disabled={isPending}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono text-sm"
              />
              <p className="text-xs text-foreground-muted mt-1.5">
                Apenas letras minúsculas, números e hífens. Mínimo 3 caracteres.
              </p>
            </div>
          </div>
        </div>

        {/* Seção 02 */}
        <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              02 · Responsável
            </span>
            <h2 className="font-display text-base font-bold text-foreground">
              Proprietário Inicial (Owner Obrigatório)
            </h2>
            <p className="text-xs text-foreground-muted leading-relaxed">
              A função SQL atômica vinculará este usuário com alçada integral e irrevogável de proprietário.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ownerFullName" required>
                Nome Completo
              </Label>
              <Input
                id="ownerFullName"
                name="ownerFullName"
                required
                value={ownerFullName}
                onChange={(e) => setOwnerFullName(e.target.value)}
                placeholder="Mariana Silva"
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="ownerEmail" required>
                E-mail Corporativo
              </Label>
              <Input
                id="ownerEmail"
                name="ownerEmail"
                type="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="mariana@floricultura.test"
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        {/* Barra de confirmação */}
        <div className="px-6 py-4 bg-surface-muted/40 flex flex-col sm:flex-row sm:items-center justify-end gap-3">
          <Link
            href="/admin/empresas"
            className="inline-flex items-center justify-center min-h-[42px] px-4 rounded-[10px] border border-surface-border bg-surface text-foreground text-xs sm:text-sm font-semibold hover:bg-surface-muted transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" isLoading={isPending} disabled={isPending}>
            <Save className="w-4 h-4" />
            Criar Estabelecimento com Atomicidade
          </Button>
        </div>
      </div>
    </form>
  );
}
