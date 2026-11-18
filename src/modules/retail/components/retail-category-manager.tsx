"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Edit, Trash2 } from "lucide-react";
import type { RetailCategory } from "../types";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "../actions/retail-category.actions";
import { ProductInvariants } from "../domain/product-invariants";

interface RetailCategoryManagerProps {
  tenantId: string;
  categories: RetailCategory[];
  userRole: string;
}

export function RetailCategoryManager({
  tenantId,
  categories,
  userRole,
}: RetailCategoryManagerProps) {
  const router = useRouter();
  const canWrite = userRole === "owner" || userRole === "manager" || userRole === "platform_admin";

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<RetailCategory | null>(null);

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState(0);
  const [isActive, setIsActive] = React.useState(true);

  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);

  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    if (isModalOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isModalOpen]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setDescription("");
    setSortOrder(categories.length);
    setIsActive(true);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: RetailCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setSortOrder(cat.sortOrder);
    setIsActive(cat.isActive);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory) {
      setSlug(ProductInvariants.slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("slug", slug || ProductInvariants.slugify(name));
    formData.append("description", description);
    formData.append("sortOrder", String(sortOrder));
    formData.append("isActive", String(isActive));

    let res;
    if (editingCategory) {
      res = await updateCategoryAction(tenantId, editingCategory.id, null, formData);
    } else {
      res = await createCategoryAction(tenantId, null, formData);
    }

    setLoading(false);

    if (!res.success) {
      setFeedback({ text: res.error || "Erro ao salvar categoria.", error: true });
    } else {
      setIsModalOpen(false);
      router.refresh();
    }
  };

  const handleDelete = async (cat: RetailCategory) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria '${cat.name}'?`)) {
      return;
    }

    setLoading(true);
    const res = await deleteCategoryAction(tenantId, cat.id);
    setLoading(false);

    if (!res.success) {
      setFeedback({ text: res.error || "Erro ao excluir categoria.", error: true });
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-[16px] border border-border shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">
            Categorias do Catálogo
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Estruture seções, departamentos e coleções para organizar seus produtos
          </p>
        </div>

        {canWrite && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs sm:text-sm font-semibold text-white shadow-xs hover:opacity-95 transition-opacity"
            style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
          >
            <Plus className="w-4 h-4" />
            <span>Nova Categoria</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-[10px] text-xs flex items-center justify-between border ${
            feedback.error
              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold text-xs px-2">
            ×
          </button>
        </div>
      )}

      {/* Tabela de Categorias */}
      <div className="rounded-[16px] bg-surface border border-border overflow-hidden shadow-xs">
        {categories.length === 0 ? (
          <div className="p-16 text-center text-foreground-muted">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <h3 className="text-sm font-semibold text-foreground">Nenhuma categoria cadastrada</h3>
            <p className="text-xs mt-1">Crie a primeira categoria para organizar seu catálogo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-16">Ordem</th>
                  <th className="py-3 px-4">Nome da Categoria</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Produtos Vinculados</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground-muted">
                      #{c.sortOrder}
                    </td>

                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-foreground text-sm">{c.name}</span>
                        {c.description && (
                          <p className="text-[11px] text-foreground-muted line-clamp-1">
                            {c.description}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-foreground-muted">
                      /{c.slug}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-surface-muted border border-border text-[11px] font-semibold text-foreground">
                        {c.productCount || 0} produtos
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          c.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {c.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {canWrite && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-[6px] text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
                            title="Editar Categoria"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-[6px] text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nativo <dialog> para Cadastro / Edição */}
      <dialog
        ref={dialogRef}
        onClose={() => setIsModalOpen(false)}
        className="rounded-[16px] bg-surface text-foreground border border-border p-6 shadow-xl backdrop:bg-black/60 max-w-md w-full"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h2 className="text-base font-bold font-display text-foreground">
            {editingCategory ? "Editar Categoria" : "Nova Categoria"}
          </h2>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-foreground-muted hover:text-foreground text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cat-modal-name" className="block text-xs font-semibold text-foreground mb-1">
              Nome da Categoria *
            </label>
            <input
              id="cat-modal-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex.: Moda Masculina"
              className="w-full px-3 py-2 rounded-[8px] bg-background border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div>
            <label htmlFor="cat-modal-slug" className="block text-xs font-semibold text-foreground mb-1">
              Slug da URL
            </label>
            <input
              id="cat-modal-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(ProductInvariants.slugify(e.target.value))}
              placeholder="moda-masculina"
              className="w-full px-3 py-2 rounded-[8px] bg-background border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div>
            <label htmlFor="cat-modal-desc" className="block text-xs font-semibold text-foreground mb-1">
              Descrição
            </label>
            <textarea
              id="cat-modal-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição breve..."
              className="w-full px-3 py-2 rounded-[8px] bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Ordem de Exibição
              </label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[8px] bg-background border border-border text-xs text-foreground"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="font-medium text-foreground">Categoria Ativa</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-2 rounded-[8px] text-xs font-medium bg-surface-muted hover:bg-surface border border-border text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-[8px] text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
            >
              {loading ? "Salvando..." : editingCategory ? "Salvar" : "Criar Categoria"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

