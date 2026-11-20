import React from "react";

interface DevEssentLogoProps {
  variant?: "navbar" | "hero" | "subtitle" | "icon" | "sidebar" | "full";
  className?: string;
}

const WHITE_FULL_PATH = "M279.8 35.0 L331.0 35.6 L343.0 38.8 L350.0 44.1 L352.3 47.0 L354.1 52.0 L354.4 61.0 L351.3 73.0 L341.3 92.0 L330.0 104.3 L315.0 113.4 L300.0 117.4 L244.0 117.2 L260.5 85.0 L274.0 59.4 L295.0 59.6 L274.0 102.0 L299.0 102.2 L309.0 99.3 L317.0 93.5 L325.2 84.0 L331.5 72.0 L333.4 66.0 L333.3 58.0 L331.0 54.5 L326.0 51.7 L320.0 50.7 L272.0 50.6 L273.5 45.0 L277.6 37.0 Z M389.3 55.0 L405.0 54.6 L414.0 55.6 L420.9 58.0 L425.0 61.1 L427.4 65.0 L427.3 74.0 L420.5 91.0 L419.0 92.5 L368.0 92.5 L366.7 93.0 L365.7 100.0 L367.0 102.3 L370.0 104.1 L378.0 105.3 L408.0 103.2 L412.8 103.0 L407.2 116.0 L406.0 117.3 L397.0 118.5 L385.0 119.5 L364.0 119.3 L356.0 117.5 L352.0 115.5 L346.9 110.0 L345.6 104.0 L346.6 96.0 L349.7 87.0 L357.7 72.0 L362.0 66.8 L370.0 60.6 L380.0 56.7 Z M432.8 57.0 L452.0 57.0 L456.0 95.4 L492.0 56.7 L512.5 57.0 L502.0 68.6 L456.0 118.4 L440.0 118.5 Z M86.8 64.0 L127.6 64.0 L67.3 133.0 L26.9 133.0 Z M387.0 68.9 L381.0 70.9 L377.0 73.5 L374.6 76.0 L371.6 82.0 L391.0 82.4 L404.9 82.0 L407.5 77.0 L407.5 72.0 L405.0 69.5 L402.0 68.6 Z";
const LILAC_FULL_PATH = "M81.8 16.0 L88.0 15.1 L208.0 15.8 L214.0 18.6 L219.0 23.0 L238.3 54.0 L215.3 87.0 L210.0 91.4 L203.0 94.2 L195.0 95.4 L125.0 95.0 L135.0 82.6 L148.8 67.0 L152.0 64.6 L202.0 64.6 L203.5 64.0 L203.5 63.0 L195.5 51.0 L190.0 46.5 L82.0 46.0 L79.5 47.0 L63.0 66.4 L43.0 66.2 L73.7 23.0 L77.2 19.0 Z M530.2 36.0 L600.0 35.7 L604.0 36.1 L604.5 37.0 L597.0 50.5 L546.0 50.9 L542.5 52.0 L535.5 67.0 L536.0 68.5 L581.0 68.5 L581.9 69.0 L581.2 71.0 L575.0 83.5 L528.0 83.5 L526.0 87.0 L518.8 101.0 L518.6 103.0 L571.0 103.9 L564.1 118.0 L489.6 118.0 L527.7 39.0 Z M933.4 39.0 L935.3 39.0 L928.0 54.0 L928.8 55.0 L946.0 55.0 L947.4 56.0 L941.0 68.4 L922.0 68.5 L920.0 69.7 L907.9 93.0 L905.5 100.0 L908.0 103.3 L928.6 103.0 L922.5 116.0 L918.0 117.5 L911.0 118.5 L897.0 118.4 L890.0 116.5 L885.0 112.0 L883.6 108.0 L884.6 101.0 L899.5 70.0 L898.0 68.8 L889.2 68.0 L895.0 55.4 L907.0 54.1 L913.0 44.9 Z M627.1 55.0 L653.0 55.6 L663.8 57.0 L657.0 69.3 L620.0 68.8 L614.0 69.7 L610.7 72.0 L609.5 74.0 L609.5 77.0 L613.0 79.5 L638.0 81.6 L644.0 83.6 L648.1 88.0 L649.1 93.0 L646.3 103.0 L638.0 112.3 L626.0 117.4 L607.0 119.4 L576.0 118.4 L571.5 117.0 L579.0 104.7 L611.0 106.0 L620.0 105.5 L626.0 102.8 L627.6 99.0 L626.0 95.8 L622.0 94.5 L604.0 93.2 L595.0 91.3 L590.6 88.0 L588.8 81.0 L591.6 71.0 L599.0 62.6 L606.0 58.7 L612.0 56.7 Z M766.4 55.0 L780.0 54.6 L791.0 55.7 L798.0 57.8 L803.0 61.4 L805.5 66.0 L805.4 72.0 L799.1 89.0 L796.0 92.4 L744.0 92.5 L742.5 94.0 L742.4 101.0 L747.0 104.5 L754.0 105.5 L784.0 103.5 L789.1 103.0 L783.5 116.0 L770.0 118.4 L752.0 119.1 L738.0 118.2 L729.0 115.1 L723.5 109.0 L722.6 102.0 L724.6 92.0 L728.5 82.0 L734.9 71.0 L741.0 64.8 L751.0 58.7 L756.0 56.8 Z M687.0 56.0 L706.0 55.1 L727.0 55.7 L735.3 57.0 L730.2 67.0 L728.0 69.5 L691.0 68.9 L686.0 69.5 L682.3 72.0 L681.0 76.0 L681.9 78.0 L684.0 79.2 L703.0 80.8 L712.0 82.6 L717.5 86.0 L719.7 91.0 L718.1 101.0 L712.8 109.0 L709.0 112.4 L703.0 115.5 L690.0 118.5 L663.0 119.1 L649.0 118.3 L642.9 117.0 L651.0 104.5 L683.0 106.1 L692.0 105.5 L695.0 104.5 L698.0 101.9 L699.2 99.0 L697.0 95.6 L670.0 92.3 L665.0 90.3 L660.6 85.0 L660.5 78.0 L661.6 74.0 L666.3 66.0 L676.0 59.0 Z M851.1 56.0 L865.0 55.4 L877.0 56.9 L883.2 61.0 L886.2 68.0 L886.2 73.0 L883.2 82.0 L866.0 117.9 L850.0 118.2 L846.7 117.0 L863.5 82.0 L864.5 79.0 L864.2 75.0 L862.0 72.0 L856.0 69.6 L842.0 70.4 L834.0 73.5 L830.5 77.0 L810.0 118.3 L791.4 118.0 L819.3 57.0 L821.0 56.2 L837.0 56.4 L836.5 59.0 L838.0 59.9 Z M762.0 68.8 L756.0 71.5 L753.0 74.1 L749.4 79.0 L748.3 81.0 L749.0 82.0 L772.0 82.2 L781.0 82.3 L783.0 81.3 L785.2 75.0 L784.1 71.0 L780.0 68.5 Z M104.7 112.0 L200.0 111.7 L200.2 113.0 L186.1 132.0 L185.0 133.3 L183.0 133.5 L87.0 133.5 L86.5 133.0 L88.7 130.0 Z";
const WHITE_ICON_PATH = "M86.8 64.0 L127.6 64.0 L67.3 133.0 L26.9 133.0 Z";
const LILAC_ICON_PATH = "M81.8 16.0 L88.0 15.1 L208.0 15.8 L214.0 18.6 L219.0 23.0 L238.3 54.0 L215.3 87.0 L210.0 91.4 L203.0 94.2 L195.0 95.4 L125.0 95.0 L135.0 82.6 L148.8 67.0 L152.0 64.6 L202.0 64.6 L203.5 64.0 L203.5 63.0 L195.5 51.0 L190.0 46.5 L82.0 46.0 L79.5 47.0 L63.0 66.4 L43.0 66.2 L73.7 23.0 L77.2 19.0 Z M104.7 112.0 L200.0 111.7 L200.2 113.0 L186.1 132.0 L185.0 133.3 L183.0 133.5 L87.0 133.5 L86.5 133.0 L88.7 130.0 Z";

/**
 * Logotipo Oficial DevEssent — Vetorização de Alta Fidelidade 1:1
 * Traçado diretamente a partir de `03_logo_wordmark.png` (950x134),
 * preservando integralmente o símbolo geométrico angular, a inclinação,
 * o kerning e o desenho original de cada letra de `DevEssent`.
 */
export function DevEssentLogo({
  variant = "navbar",
  className = "",
}: DevEssentLogoProps) {
  const uniqueId = React.useId();
  const gradId = `de-logo-grad-${uniqueId}`;

  if (variant === "icon") {
    return (
      <svg
        viewBox="20 4 222 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="DevEssent"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B695FF" />
            <stop offset="100%" stopColor="#A782FF" />
          </linearGradient>
        </defs>
        <path
          d={LILAC_ICON_PATH}
          fill={`url(#${gradId})`}
          fillRule="evenodd"
          clipRule="evenodd"
        />
        <path
          d={WHITE_ICON_PATH}
          fill="#E9E7DF"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  const isHero = variant === "hero";
  const showSubtitle = variant === "subtitle";
  const isSidebar = variant === "sidebar";

  const svgSizeClass = isHero
    ? "h-11 sm:h-15 md:h-[4.25rem] xl:h-[4.65rem] w-auto drop-shadow-[0_0_24px_rgba(167,130,255,0.22)]"
    : isSidebar
    ? "h-6 sm:h-7 w-auto"
    : "h-[22px] sm:h-7 md:h-8 w-auto";

  return (
    <span className={`inline-flex flex-col select-none ${className}`}>
      <svg
        viewBox="20 4 926 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="DevEssent"
        className={svgSizeClass}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B695FF" />
            <stop offset="55%" stopColor="#A782FF" />
            <stop offset="100%" stopColor="#B695FF" />
          </linearGradient>
        </defs>
        <path
          d={LILAC_FULL_PATH}
          fill={`url(#${gradId})`}
          fillRule="evenodd"
          clipRule="evenodd"
        />
        <path
          d={WHITE_FULL_PATH}
          fill="#E9E7DF"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
      {showSubtitle && (
        <span className="font-tech text-[0.58rem] tracking-[0.42em] text-[#BAB5C5] uppercase mt-2 pl-[24%]">
          SOFTWARE HOUSE
        </span>
      )}
    </span>
  );
}
