import type { StorefrontTemplate } from "../../types/retail.types";

interface ProductImageFallbackProps {
  name: string;
  template?: StorefrontTemplate;
  className?: string;
}

export function ProductImageFallback({
  name,
  template = "editorial",
  className = "",
}: ProductImageFallbackProps) {
  const isDark = template === "experimental";
  const lowerName = name.toLowerCase();

  // Escolha do ícone / forma vetorial de acordo com o nome
  const isHoodie = lowerName.includes("moletom") || lowerName.includes("hoodie");
  const isPants = lowerName.includes("calça") || lowerName.includes("cargo") || lowerName.includes("pants");
  const isJacket = lowerName.includes("jaqueta") || lowerName.includes("jacket") || lowerName.includes("casaco");
  const isVase = lowerName.includes("vaso") || lowerName.includes("planta") || lowerName.includes("cerâmica");

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center p-6 select-none ${
        isDark
          ? "bg-[#18181b] text-neutral-300 border border-neutral-800"
          : "bg-[#f1efe9] text-stone-700"
      } ${className}`}
    >
      <div className="relative w-28 h-28 flex items-center justify-center opacity-85 transition-transform duration-500 group-hover:scale-105">
        {isHoodie && (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M30 25 L40 18 C45 15 55 15 60 18 L70 25 L88 45 L78 52 L72 38 L72 85 C72 88 70 90 66 90 L34 90 C30 90 28 88 28 85 L28 38 L22 52 L12 45 Z" fill={isDark ? "#222226" : "#e5e2da"} />
            <path d="M42 22 C42 28 46 32 50 32 C54 32 58 28 58 22" />
            <path d="M36 68 L64 68 C66 68 67 70 67 72 L67 86 L33 86 L33 72 C33 70 34 68 36 68 Z" strokeDasharray="3 3" />
          </svg>
        )}
        {isPants && (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 18 L68 18 L72 88 L54 88 L50 48 L46 88 L28 88 Z" fill={isDark ? "#222226" : "#e5e2da"} />
            <line x1="32" y1="24" x2="68" y2="24" />
            <rect x="30" y="38" width="8" height="14" rx="2" strokeDasharray="2 2" />
            <rect x="62" y="38" width="8" height="14" rx="2" strokeDasharray="2 2" />
          </svg>
        )}
        {isJacket && (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M28 24 L42 20 L50 26 L58 20 L72 24 L86 42 L76 48 L70 36 L70 88 L30 88 L30 36 L24 48 L14 42 Z" fill={isDark ? "#222226" : "#e5e2da"} />
            <line x1="50" y1="26" x2="50" y2="88" strokeWidth="2" />
            <path d="M42 20 L50 38 L58 20" />
            <rect x="34" y="52" width="10" height="12" rx="1.5" />
            <rect x="56" y="52" width="10" height="12" rx="1.5" />
          </svg>
        )}
        {isVase && (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="50" cy="24" rx="16" ry="6" fill={isDark ? "#2a2a30" : "#d8d3c7"} />
            <path d="M34 24 C28 45 22 55 24 72 C26 84 36 88 50 88 C64 88 74 84 76 72 C78 55 72 45 66 24" fill={isDark ? "#222226" : "#e5e2da"} />
            <path d="M50 20 C48 10 40 4 34 6 C30 14 44 18 50 20" stroke="#10b981" strokeWidth="2" />
          </svg>
        )}
        {!isHoodie && !isPants && !isJacket && !isVase && (
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 20 L42 16 C46 22 54 22 58 16 L68 20 L84 38 L74 44 L68 34 L68 88 L32 88 L32 34 L26 44 L16 38 Z" fill={isDark ? "#222226" : "#e5e2da"} />
            <path d="M42 16 C46 22 54 22 58 16" />
          </svg>
        )}
      </div>

      <span
        className={`mt-4 text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full ${
          isDark
            ? "bg-neutral-900/90 text-neutral-400 border border-neutral-800"
            : "bg-stone-200/80 text-stone-600"
        }`}
      >
        Peça Autoral
      </span>
    </div>
  );
}

