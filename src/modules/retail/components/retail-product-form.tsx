"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Upload,
  Star,
  ArrowLeft,
  Save,
  Tag,
  Boxes,
} from "lucide-react";
import type {
  RetailCategory,
  RetailProductWithDetails,
  RetailProductStatus,
} from "../types";
import { ProductInvariants } from "../domain/product-invariants";
import { VariantInvariants } from "../domain/variant-invariants";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
} from "../actions/retail-product.actions";
import {
  uploadProductImageAction,
  deleteProductImageAction,
  setPrimaryImageAction,
} from "../actions/retail-image.actions";

interface RetailProductFormProps {
  tenantId: string;
  currency?: string;
  categories: RetailCategory[];
  initialProduct?: RetailProductWithDetails | null;
  userRole: string;
}

export function RetailProductForm({
  tenantId,
  currency: _currency = "BRL",
  categories,
  initialProduct,
  userRole,
}: RetailProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialProduct);

  const canWrite = userRole === "owner" || userRole === "manager" || userRole === "platform_admin";

  // 1. Informações Básicas
  const [name, setName] = React.useState(initialProduct?.name || "");
  const [slug, setSlug] = React.useState(initialProduct?.slug || "");
  const [description, setDescription] = React.useState(initialProduct?.description || "");

  // 2. Categorias
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>(
    initialProduct?.categories.map((c) => c.id) || []
  );

  // 3. Status de Publicação
  const [status, setStatus] = React.useState<RetailProductStatus>(
    initialProduct?.status || "draft"
  );

  // 4. Opções e Variantes
  const [options, setOptions] = React.useState<Array<{ name: string; values: string[] }>>(
    initialProduct?.options.map((o) => ({ name: o.name, values: o.values })) || []
  );

  const [newOptionName, setNewOptionName] = React.useState("");
  const [newOptionValue, setNewOptionValue] = React.useState("");

  const [variants, setVariants] = React.useState<
    Array<{
      id?: string;
      sku: string;
      name: string;
      priceCents: number;
      compareAtPriceCents: number | null;
      stockQuantity: number;
      isAvailable: boolean;
      optionsSummary: Record<string, string>;
    }>
  >(
    initialProduct?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      priceCents: v.priceCents,
      compareAtPriceCents: v.compareAtPriceCents,
      stockQuantity: v.stockQuantity,
      isAvailable: v.isAvailable,
      optionsSummary: v.optionsSummary,
    })) || [
      {
        sku: "PROD-001",
        name: "Padrão",
        priceCents: 9900,
        compareAtPriceCents: null,
        stockQuantity: 10,
        isAvailable: true,
        optionsSummary: {},
      },
    ]
  );

  // 5. Estado de UI / Feedback
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Auto-slug se for novo produto
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && (!slug || slug === ProductInvariants.slugify(name))) {
      setSlug(ProductInvariants.slugify(val));
    }
  };

  // Toggle Categoria
  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Adicionar Opção
  const handleAddOption = () => {
    if (!newOptionName.trim()) return;
    const values = newOptionValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) return;

    const nextOptions = [...options, { name: newOptionName.trim(), values }];
    setOptions(nextOptions);
    setNewOptionName("");
    setNewOptionValue("");

    // Recalcular variantes combinadas
    const combos = VariantInvariants.generateCombinations(nextOptions);
    if (combos.length > 0) {
      const nextVariants = combos.map((combo, idx) => {
        const comboName = Object.values(combo).join(" / ");
        const baseSku = (slug || "SKU").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const skuSuffix = Object.values(combo)
          .join("-")
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, "");
        return {
          sku: `${baseSku}-${skuSuffix || idx + 1}`,
          name: comboName,
          priceCents: variants[0]?.priceCents || 9900,
          compareAtPriceCents: variants[0]?.compareAtPriceCents || null,
          stockQuantity: 10,
          isAvailable: true,
          optionsSummary: combo,
        };
      });
      setVariants(nextVariants);
    }
  };

  // Remover Opção
  const handleRemoveOption = (index: number) => {
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
  };

  // Atualizar Variante específica
  const handleVariantChange = (
    index: number,
    field: string,
    value: string | number | boolean | null
  ) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  // Checklist de Publicação
  const publicationCheck = React.useMemo(() => {
    return ProductInvariants.checkPublicationReadiness({
      name,
      variants,
      images: initialProduct?.images,
    });
  }, [name, variants, initialProduct]);

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (status === "published" && !publicationCheck.canPublish) {
      setError(
        `Não é possível publicar: ${publicationCheck.reasons.join(" ")}`
      );
      setLoading(false);
      return;
    }

    try {
      if (isEdit && initialProduct) {
        const res = await updateProductAction(tenantId, {
          id: initialProduct.id,
          name,
          slug,
          description: description || null,
          status,
          categoryIds: selectedCategoryIds,
          options: options.map((o, idx) => ({ name: o.name, values: o.values, position: idx })),
          variants: variants.map((v, idx) => ({ ...v, sortOrder: idx })),
        });

        if (!res.success) {
          setError(res.error || "Falha ao atualizar produto.");
        } else {
          setSuccess("Produto atualizado com sucesso!");
          router.refresh();
        }
      } else {
        const res = await createProductAction(tenantId, {
          name,
          slug,
          description: description || null,
          status,
          categoryIds: selectedCategoryIds,
          options: options.map((o, idx) => ({ name: o.name, values: o.values, position: idx })),
          variants: variants.map((v, idx) => ({ ...v, sortOrder: idx })),
        });

        if (!res.success) {
          setError(res.error || "Falha ao criar produto.");
        } else {
          const createdProduct = res.data as { id: string } | undefined;
          if (createdProduct?.id) {
            router.push(`/dashboard/retail/produtos/${createdProduct.id}`);
          } else {
            router.push("/dashboard/retail/produtos");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload de Imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!initialProduct || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("altText", name);

    setUploadingImage(true);
    setError(null);

    const res = await uploadProductImageAction(tenantId, initialProduct.id, formData);
    setUploadingImage(false);

    if (!res.success) {
      setError(res.error || "Erro no upload da imagem.");
    } else {
      router.refresh();
    }
  };

  // Excluir Imagem
  const handleDeleteImage = async (imageId: string) => {
    if (!initialProduct) return;
    setError(null);
    const res = await deleteProductImageAction(tenantId, initialProduct.id, imageId);
    if (!res.success) {
      setError(res.error || "Erro ao excluir imagem.");
    } else {
      router.refresh();
    }
  };

  // Definir Imagem Principal
  const handleSetPrimary = async (imageId: string) => {
    if (!initialProduct) return;
    setError(null);
    const res = await setPrimaryImageAction(tenantId, initialProduct.id, imageId);
    if (!res.success) {
      setError(res.error || "Erro ao definir imagem principal.");
    } else {
      router.refresh();
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async () => {
    if (!initialProduct || !confirm("Tem certeza que deseja excluir este produto do catálogo?")) {
      return;
    }
    setLoading(true);
    const res = await deleteProductAction(tenantId, initialProduct.id);
    if (!res.success) {
      setError(res.error || "Erro ao excluir produto.");
      setLoading(false);
    } else {
      router.push("/dashboard/retail/produtos");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Barra de Topo com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/retail/produtos"
            className="w-9 h-9 rounded-[8px] bg-surface border border-border flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
            title="Voltar ao Catálogo"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {isEdit ? "Editar Produto" : "Novo Produto Comercial"}
            </h1>
            <p className="text-xs text-foreground-muted">
              {isEdit && initialProduct ? `ID: ${initialProduct.id}` : "Preencha as informações para compor o catálogo"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEdit && canWrite && (
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={loading}
              className="px-3 py-2 rounded-[10px] text-xs font-semibold text-red-600 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              Excluir
            </button>
          )}

          {canWrite && (
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-xs sm:text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--t-fill, var(--accent))" }}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Produto"}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* SEÇÃO 1: Informações Básicas */}
      <section className="bg-surface p-6 rounded-[16px] border border-border space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Package className="w-4 h-4" style={{ color: "var(--t-ink, var(--accent))" }} />
          <h2 className="text-base font-semibold font-display text-foreground">
            1. Informações Básicas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-name" className="block text-xs font-semibold text-foreground mb-1.5">
              Nome do Produto *
            </label>
            <input
              id="product-name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex.: Camiseta Essential Linho"
              className="w-full px-3.5 py-2 rounded-[10px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div>
            <label htmlFor="product-slug" className="block text-xs font-semibold text-foreground mb-1.5">
              Slug da URL *
            </label>
            <input
              id="product-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(ProductInvariants.slugify(e.target.value))}
              placeholder="camiseta-essential-linho"
              className="w-full px-3.5 py-2 rounded-[10px] bg-background border border-border font-mono text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        <div>
          <label htmlFor="product-description" className="block text-xs font-semibold text-foreground mb-1.5">
            Descrição do Produto
          </label>
          <textarea
            id="product-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva detalhes, composição, especificações ou características da peça..."
            className="w-full px-3.5 py-2 rounded-[10px] bg-background border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
      </section>

      {/* SEÇÃO 2: Categorias */}
      <section className="bg-surface p-6 rounded-[16px] border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4" style={{ color: "var(--t-ink, var(--accent))" }} />
            <h2 className="text-base font-semibold font-display text-foreground">
              2. Categorias do Produto
            </h2>
          </div>
          <Link
            href="/dashboard/retail/categorias"
            className="text-xs text-foreground-muted hover:text-foreground underline"
          >
            Gerenciar Categorias
          </Link>
        </div>

        {categories.length === 0 ? (
          <p className="text-xs text-foreground-muted italic">
            Nenhuma categoria cadastrada ainda. Crie categorias na aba lateral para organizar seu catálogo.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const isSelected = selectedCategoryIds.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? "bg-foreground text-background border-foreground font-semibold"
                      : "bg-surface-muted text-foreground-muted border-border hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO 3: Imagens e Mídia */}
      <section className="bg-surface p-6 rounded-[16px] border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" style={{ color: "var(--t-ink, var(--accent))" }} />
            <h2 className="text-base font-semibold font-display text-foreground">
              3. Imagens do Produto (Supabase Storage)
            </h2>
          </div>
          {isEdit && (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-surface-muted border border-border text-xs font-semibold text-foreground hover:bg-surface cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingImage ? "Enviando..." : "Adicionar Imagem"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
          )}
        </div>

        {!isEdit ? (
          <p className="text-xs text-foreground-muted italic">
            O upload de imagens com visualização em galeria estará disponível imediatamente após criar o produto.
          </p>
        ) : initialProduct?.images.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-[12px] text-center text-foreground-muted">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma imagem enviada para este produto.</p>
            <p className="text-[11px] mt-0.5">Formatos aceitos: JPG, PNG, WebP e GIF (máx 5MB).</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {initialProduct?.images.map((img) => (
              <div
                key={img.id}
                className={`relative group rounded-[10px] overflow-hidden border bg-surface-muted flex flex-col ${
                  img.isPrimary ? "ring-2 ring-foreground border-transparent" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.publicUrl}
                  alt={img.altText || name}
                  className="w-full h-36 object-cover"
                />
                <div className="p-2 bg-surface flex items-center justify-between border-t border-border">
                  {img.isPrimary ? (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Principal
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.id)}
                      className="text-[10px] text-foreground-muted hover:text-foreground font-medium"
                    >
                      Tornar Principal
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="text-foreground-muted hover:text-red-500 p-1 transition-colors"
                    title="Excluir imagem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 4: Opções e Variantes */}
      <section className="bg-surface p-6 rounded-[16px] border border-border space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Boxes className="w-4 h-4" style={{ color: "var(--t-ink, var(--accent))" }} />
          <h2 className="text-base font-semibold font-display text-foreground">
            4. Atributos, Opções e Variantes
          </h2>
        </div>

        {/* Gerador de Opções */}
        <div className="p-4 rounded-[12px] bg-surface-muted/60 border border-border space-y-3">
          <span className="text-xs font-semibold text-foreground block">
            Adicionar Atributo (Ex.: Tamanho, Cor, Material)
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Nome (ex: Tamanho)"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              className="px-3 py-1.5 rounded-[8px] bg-background border border-border text-xs sm:w-1/3 text-foreground"
            />
            <input
              type="text"
              placeholder="Valores separados por vírgula (ex: P, M, G, GG)"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              className="px-3 py-1.5 rounded-[8px] bg-background border border-border text-xs flex-1 text-foreground"
            />
            <button
              type="button"
              onClick={handleAddOption}
              className="px-4 py-1.5 rounded-[8px] bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors shrink-0"
            >
              Adicionar Opção
            </button>
          </div>

          {options.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {options.map((opt, idx) => (
                <div
                  key={opt.name}
                  className="px-2.5 py-1 rounded-[8px] bg-surface border border-border text-xs flex items-center gap-2"
                >
                  <span className="font-semibold text-foreground">{opt.name}:</span>
                  <span className="text-foreground-muted">{opt.values.join(", ")}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-foreground-muted hover:text-red-500 font-bold ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Variantes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted/50 text-foreground-muted font-mono uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">SKU *</th>
                <th className="py-2.5 px-3">Variante / Nome</th>
                <th className="py-2.5 px-3">Preço Venda (R$) *</th>
                <th className="py-2.5 px-3">Preço Comparativo (R$)</th>
                <th className="py-2.5 px-3">Estoque</th>
                <th className="py-2.5 px-3 text-center">Disponível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {variants.map((v, idx) => (
                <tr key={idx} className="hover:bg-surface-muted/20">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      required
                      value={v.sku}
                      onChange={(e) => handleVariantChange(idx, "sku", e.target.value.toUpperCase())}
                      className="w-28 px-2 py-1 rounded-[6px] bg-background border border-border font-mono text-xs uppercase text-foreground"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="text"
                      required
                      value={v.name}
                      onChange={(e) => handleVariantChange(idx, "name", e.target.value)}
                      className="w-32 px-2 py-1 rounded-[6px] bg-background border border-border text-xs text-foreground"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={(v.priceCents / 100).toFixed(2)}
                      onChange={(e) =>
                        handleVariantChange(
                          idx,
                          "priceCents",
                          ProductInvariants.parseToCents(e.target.value)
                        )
                      }
                      className="w-24 px-2 py-1 rounded-[6px] bg-background border border-border font-mono text-xs text-foreground"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.compareAtPriceCents ? (v.compareAtPriceCents / 100).toFixed(2) : ""}
                      onChange={(e) =>
                        handleVariantChange(
                          idx,
                          "compareAtPriceCents",
                          e.target.value ? ProductInvariants.parseToCents(e.target.value) : null
                        )
                      }
                      placeholder="—"
                      className="w-24 px-2 py-1 rounded-[6px] bg-background border border-border font-mono text-xs text-foreground"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      value={v.stockQuantity}
                      onChange={(e) =>
                        handleVariantChange(idx, "stockQuantity", Number(e.target.value))
                      }
                      className="w-16 px-2 py-1 rounded-[6px] bg-background border border-border font-mono text-xs text-foreground"
                    />
                  </td>

                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={v.isAvailable}
                      onChange={(e) => handleVariantChange(idx, "isAvailable", e.target.checked)}
                      className="rounded border-border"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SEÇÃO 5: Publicação & Governança */}
      <section className="bg-surface p-6 rounded-[16px] border border-border space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--t-ink, var(--accent))" }} />
          <h2 className="text-base font-semibold font-display text-foreground">
            5. Estado de Publicação no Catálogo
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label
            className={`p-4 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-colors ${
              status === "draft"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300"
                : "bg-surface-muted/40 border-border text-foreground-muted"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="status"
                value="draft"
                checked={status === "draft"}
                onChange={() => setStatus("draft")}
              />
              <span className="font-semibold text-sm">Rascunho</span>
            </div>
            <p className="text-xs opacity-80">
              Produto visível apenas internamente para a equipe operacional.
            </p>
          </label>

          <label
            className={`p-4 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-colors ${
              status === "published"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-surface-muted/40 border-border text-foreground-muted"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="status"
                value="published"
                checked={status === "published"}
                onChange={() => setStatus("published")}
              />
              <span className="font-semibold text-sm">Publicado</span>
            </div>
            <p className="text-xs opacity-80">
              Elegível para exibição comercial na vitrine da loja.
            </p>
          </label>

          <label
            className={`p-4 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-colors ${
              status === "archived"
                ? "bg-zinc-500/10 border-zinc-500/40 text-zinc-700 dark:text-zinc-300"
                : "bg-surface-muted/40 border-border text-foreground-muted"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="status"
                value="archived"
                checked={status === "archived"}
                onChange={() => setStatus("archived")}
              />
              <span className="font-semibold text-sm">Arquivado</span>
            </div>
            <p className="text-xs opacity-80">
              Removido da vitrine sem exclusão permanente do histórico.
            </p>
          </label>
        </div>

        {/* Checklist de Validação */}
        <div className="p-4 rounded-[12px] bg-surface-muted/40 border border-border text-xs space-y-1.5">
          <span className="font-semibold text-foreground block mb-1">
            Critérios para Publicação Comercial:
          </span>
          <div className="flex items-center gap-2">
            <span
              className={name.trim().length >= 2 ? "text-emerald-500" : "text-foreground-muted"}
            >
              {name.trim().length >= 2 ? "✓" : "○"}
            </span>
            <span>Nome válido (mínimo 2 caracteres)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={variants.length >= 1 ? "text-emerald-500" : "text-foreground-muted"}
            >
              {variants.length >= 1 ? "✓" : "○"}
            </span>
            <span>Pelo menos 1 variante cadastrada</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                variants.every((v) => v.priceCents > 0)
                  ? "text-emerald-500"
                  : "text-foreground-muted"
              }
            >
              {variants.every((v) => v.priceCents > 0) ? "✓" : "○"}
            </span>
            <span>Preço de venda maior que zero em todas as variantes</span>
          </div>
        </div>
      </section>
    </form>
  );
}

