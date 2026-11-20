import React from "react";

/**
 * Barras paralelas inclinadas `//////` (4 preenchidas + 2 vazadas)
 * Reproduzidas fielmente de `01_landing_page_referencia.png` e `06_componentes_graficos_icones.png`.
 */
export function TechSlantedBars({
  className = "",
  variant = "filled-first",
}: {
  className?: string;
  variant?: "filled-first" | "outline-first" | "all-filled";
}) {
  const items = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox="0 0 68 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`h-2.5 w-auto shrink-0 ${className}`}
    >
      {items.map((i) => {
        const x = i * 10.5;
        const isFilled =
          variant === "all-filled"
            ? true
            : variant === "filled-first"
            ? i < 4
            : i >= 3;
        return (
          <polygon
            key={i}
            points={`${x + 5},1 ${x + 10},1 ${x + 5},11 ${x},11`}
            fill={isFilled ? "#A782FF" : "transparent"}
            stroke="#A782FF"
            strokeWidth="1"
            strokeOpacity={isFilled ? "1" : "0.65"}
          />
        );
      })}
    </svg>
  );
}

/**
 * Mira técnica circular de `06_componentes_graficos_icones.png`
 */
export function TechCrosshair({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="16"
        cy="16"
        r="9.5"
        stroke="#E9E7DF"
        strokeOpacity="0.65"
        strokeWidth="1.2"
      />
      <line
        x1="16"
        y1="2"
        x2="16"
        y2="30"
        stroke="#A782FF"
        strokeOpacity="0.8"
        strokeWidth="1.2"
      />
      <line
        x1="2"
        y1="16"
        x2="30"
        y2="16"
        stroke="#A782FF"
        strokeOpacity="0.8"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * Código de barras vertical lilás de `06_componentes_graficos_icones.png`
 */
export function TechBarcode({ className = "h-3.5 w-auto" }: { className?: string }) {
  const widths = [3, 2, 3, 1.5, 3, 2, 1.5, 3, 2, 1.5, 2, 1.5, 1.5, 1];
  let currentX = 0;

  return (
    <svg
      viewBox="0 0 64 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {widths.map((w, idx) => {
        const x = currentX;
        currentX += w + 2.4;
        const opacity = 1 - idx * 0.04;
        return (
          <rect
            key={idx}
            x={x}
            y={1}
            width={w}
            height={12}
            fill={idx % 3 === 0 ? "#B695FF" : "#A782FF"}
            fillOpacity={Math.max(0.35, opacity)}
          />
        );
      })}
    </svg>
  );
}

/**
 * Globo em wireframe com cantoneiras técnicas de `02_brandboard_identidade.png`
 */
export function TechWireframeGlobe({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Cantoneiras externas */}
      <path d="M8 24 V8 H24" stroke="#E9E7DF" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M96 8 H112 V24" stroke="#E9E7DF" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M8 96 V112 H24" stroke="#E9E7DF" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M96 112 H112 V96" stroke="#E9E7DF" strokeOpacity="0.7" strokeWidth="1.5" />

      {/* Esfera externa */}
      <circle
        cx="60"
        cy="60"
        r="40"
        stroke="#E9E7DF"
        strokeOpacity="0.85"
        strokeWidth="1.2"
      />
      {/* Meridianos */}
      <ellipse
        cx="60"
        cy="60"
        rx="26"
        ry="40"
        stroke="#A782FF"
        strokeOpacity="0.65"
        strokeWidth="1"
      />
      <ellipse
        cx="60"
        cy="60"
        rx="12"
        ry="40"
        stroke="#E9E7DF"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <line
        x1="60"
        y1="20"
        x2="60"
        y2="100"
        stroke="#A782FF"
        strokeOpacity="0.7"
        strokeWidth="1"
      />
      {/* Paralelos */}
      <line
        x1="20"
        y1="60"
        x2="100"
        y2="60"
        stroke="#A782FF"
        strokeOpacity="0.7"
        strokeWidth="1"
      />
      <path
        d="M24 44 Q60 50 96 44"
        stroke="#E9E7DF"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <path
        d="M24 76 Q60 70 96 76"
        stroke="#E9E7DF"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <path
        d="M33 30 Q60 35 87 30"
        stroke="#A782FF"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      <path
        d="M33 90 Q60 85 87 90"
        stroke="#A782FF"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * Selo octogonal editorial `本質 / ESSENT` fiel a `01_landing_page_referencia.png`
 */
export function EssentOctagonBadge({
  subtitle = "ESSENT",
  className = "",
}: {
  subtitle?: "ESSENT" | "ESSÊNCIA";
  className?: string;
}) {
  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 128 138"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-full absolute inset-0"
      >
        <polygon
          points="16,2 112,2 126,16 126,122 112,136 16,136 2,122 2,16"
          fill="#0E0C16"
          fillOpacity="0.88"
          stroke="#E9E7DF"
          strokeOpacity="0.75"
          strokeWidth="1.4"
        />
        <polygon
          points="19,6 109,6 122,19 122,119 109,132 19,132 6,119 6,19"
          fill="none"
          stroke="#A782FF"
          strokeOpacity="0.22"
          strokeWidth="0.8"
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center px-5 py-4 text-center">
        <span
          lang="ja"
          className="text-2xl sm:text-[1.85rem] font-bold tracking-wider text-[#E9E7DF] leading-none select-none"
        >
          本質
        </span>
        <span className="font-tech text-[0.68rem] sm:text-xs tracking-[0.26em] text-[#E9E7DF] uppercase mt-2.5">
          {subtitle}
        </span>
        <span
          aria-hidden="true"
          className="mt-2 h-[3.5px] w-16 bg-gradient-to-r from-[#A782FF] via-[#B695FF] to-[#A782FF] rounded-full shadow-[0_0_10px_rgba(167,130,255,0.65)]"
        />
      </div>
    </div>
  );
}

/**
 * Ícones lineares da identidade DevEssent (`06_componentes_graficos_icones.png` e `08_ui_cards_da_landing.png`)
 */
export function SystemIcon({
  type,
  className = "w-6 h-6",
}: {
  type:
    | "code"
    | "layers"
    | "shield"
    | "chart"
    | "site"
    | "pages"
    | "catalog"
    | "schedule"
    | "custom"
    | "crm"
    | "os";
  className?: string;
}) {
  switch (type) {
    case "pages":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <rect
            x="5"
            y="5"
            width="18"
            height="18"
            rx="2.5"
            stroke="#E9E7DF"
            strokeWidth="1.7"
          />
          <path d="M5 10H23" stroke="#A782FF" strokeWidth="1.5" />
          <path d="M9 14.5H19" stroke="#E9E7DF" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 18.5H15" stroke="#B695FF" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "code":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <path
            d="M9.5 9.5L4.5 14L9.5 18.5M18.5 9.5L23.5 14L18.5 18.5M15.8 7.5L12.2 20.5"
            stroke="#E9E7DF"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "layers":
    case "custom":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <path
            d="M14 5.5L22.5 10L14 14.5L5.5 10L14 5.5Z"
            stroke="#E9E7DF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 14L14 18.5L22.5 14"
            stroke="#B695FF"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 18L14 22.5L22.5 18"
            stroke="#E9E7DF"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <path
            d="M14 4.8L21.5 8V13.8C21.5 18.5 18.3 22.1 14 23.5C9.7 22.1 6.5 18.5 6.5 13.8V8L14 4.8Z"
            stroke="#E9E7DF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M10.8 14.2L13 16.4L17.5 11.8"
            stroke="#B695FF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "chart":
    case "crm":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <rect x="6" y="16" width="3.2" height="6" rx="0.8" stroke="#E9E7DF" strokeWidth="1.6" />
          <rect x="11" y="13" width="3.2" height="9" rx="0.8" stroke="#B695FF" strokeWidth="1.6" />
          <rect x="16" y="9.5" width="3.2" height="12.5" rx="0.8" stroke="#E9E7DF" strokeWidth="1.6" />
          <path
            d="M6.5 12.5L12 9L18.5 5.5"
            stroke="#A782FF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "site":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <rect
            x="4.5"
            y="6"
            width="19"
            height="16"
            rx="2.5"
            stroke="#E9E7DF"
            strokeWidth="1.7"
          />
          <line x1="4.5" y1="10.5" x2="23.5" y2="10.5" stroke="#A782FF" strokeWidth="1.5" />
          <circle cx="7.5" cy="8.3" r="0.9" fill="#B695FF" />
          <circle cx="10.2" cy="8.3" r="0.9" fill="#E9E7DF" />
          <circle cx="20" cy="18.5" r="1" fill="#A782FF" />
        </svg>
      );
    case "catalog":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <path
            d="M5 7H8.2L10.4 17.2H20.5L22.5 10H9.2"
            stroke="#E9E7DF"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11.5" cy="21" r="1.6" stroke="#B695FF" strokeWidth="1.6" />
          <circle cx="19" cy="21" r="1.6" stroke="#B695FF" strokeWidth="1.6" />
        </svg>
      );
    case "schedule":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <rect
            x="5"
            y="6.5"
            width="18"
            height="16"
            rx="2.5"
            stroke="#E9E7DF"
            strokeWidth="1.7"
          />
          <line x1="9.5" y1="4.5" x2="9.5" y2="8.5" stroke="#A782FF" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="18.5" y1="4.5" x2="18.5" y2="8.5" stroke="#A782FF" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="5" y1="11.5" x2="23" y2="11.5" stroke="#E9E7DF" strokeWidth="1.5" />
          <circle cx="10" cy="15.5" r="1.1" fill="#B695FF" />
          <circle cx="14" cy="15.5" r="1.1" fill="#E9E7DF" />
          <circle cx="18" cy="18.5" r="1.1" fill="#A782FF" />
        </svg>
      );
    case "os":
      return (
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
          <rect
            x="6"
            y="5"
            width="16"
            height="18"
            rx="2.2"
            stroke="#E9E7DF"
            strokeWidth="1.7"
          />
          <path d="M10 10.5H18" stroke="#A782FF" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 14.5H18" stroke="#E9E7DF" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 18.5H14.5" stroke="#B695FF" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

