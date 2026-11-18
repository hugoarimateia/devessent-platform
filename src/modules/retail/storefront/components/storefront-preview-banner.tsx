import { Eye, X } from "lucide-react";
import type { StorefrontTemplate } from "../../types/retail.types";

interface StorefrontPreviewBannerProps {
  currentTemplate: StorefrontTemplate;
  publishedTemplate: StorefrontTemplate;
  storeSlug: string;
}

export function StorefrontPreviewBanner({
  currentTemplate,
  publishedTemplate,
  storeSlug,
}: StorefrontPreviewBannerProps) {
  const isDifferent = currentTemplate !== publishedTemplate;

  return (
    <aside
      aria-label="Aviso de modo pré-visualização"
      className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-medium sticky top-0 z-50 flex items-center justify-between border-b border-amber-600 shadow-sm"
    >
      <div className="flex items-center gap-2 max-w-5xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 shrink-0" />
          <span>
            <strong>Modo de Pré-visualização:</strong> Exibindo template{" "}
            <span className="uppercase font-bold tracking-wider underline">
              {currentTemplate}
            </span>
            {isDifferent && (
              <span className="opacity-90 ml-1">
                (O template publicado no banco é <strong>{publishedTemplate}</strong>)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/loja/${storeSlug}`}
            className="inline-flex items-center gap-1 bg-stone-950 text-white px-2.5 py-1 rounded text-[11px] font-semibold hover:bg-stone-800 transition-colors"
          >
            <span>Encerrar Preview</span>
            <X className="w-3 h-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
