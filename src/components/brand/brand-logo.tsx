import * as React from "react";

export interface BrandLogoProps {
  /**
   * Força a versão clara/invertida (branco + lilás) mesmo quando o tema ativo for claro.
   * Útil em superfícies institucionais permanentemente escuras (ex.: painel lateral do login).
   */
  inverted?: boolean;
  /**
   * Exibe apenas o símbolo geométrico original (ex.: sidebar recolhida).
   */
  compact?: boolean;
  /**
   * Escala proporcional do logotipo oficial sem deformação.
   */
  size?: "sm" | "md" | "lg";
  /**
   * Classes utilitárias adicionais para o contêiner.
   */
  className?: string;
  /**
   * Propriedade legada ignorada na composição da marca para preservar a integridade
   * do logotipo oficial sem textos acoplados ("Workspace", "Platform", etc.).
   */
  subtitle?: string;
}

/**
 * Componente compartilhado `BrandLogo` para a identidade institucional oficial DevEssent.
 * Utiliza exclusivamente o asset original da marca (símbolo geométrico + wordmark DevEssent),
 * preservando proporções, inclinação, espaçamento e cores em Dark Mode e Light Mode.
 */
export function BrandLogo({
  inverted = false,
  compact = false,
  size = "md",
  className = "",
}: BrandLogoProps) {
  const heightClass = compact
    ? size === "lg"
      ? "h-7 w-auto"
      : size === "sm"
      ? "h-[21px] w-auto"
      : "h-6 w-auto"
    : size === "lg"
    ? "h-[26px] sm:h-[30px] w-auto"
    : size === "sm"
    ? "h-[22px] w-auto"
    : "h-[24px] w-auto";

  const intrinsicWidth = compact ? 244 : 984;
  const intrinsicHeight = 158;

  const darkWebp = compact
    ? "/images/brand/devessent-symbol-dark.webp"
    : "/images/brand/devessent-logo-dark.webp";
  const darkPng = compact
    ? "/images/brand/devessent-symbol-dark.png"
    : "/images/brand/devessent-logo-dark.png";

  const lightWebp = compact
    ? "/images/brand/devessent-symbol-light.webp"
    : "/images/brand/devessent-logo-light.webp";
  const lightPng = compact
    ? "/images/brand/devessent-symbol-light.png"
    : "/images/brand/devessent-logo-light.png";

  if (inverted) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 select-none ${className}`.trim()}
      >
        <picture className="inline-flex items-center">
          <source srcSet={darkWebp} type="image/webp" />
          <img
            src={darkPng}
            alt="DevEssent"
            width={intrinsicWidth}
            height={intrinsicHeight}
            decoding="async"
            draggable={false}
            className={`${heightClass} object-contain block`}
          />
        </picture>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`.trim()}
    >
      {/* Versão para Light Mode (contraste escuro + lilás oficial) */}
      <picture className="inline-flex items-center dark:hidden">
        <source srcSet={lightWebp} type="image/webp" />
        <img
          src={lightPng}
          alt="DevEssent"
          width={intrinsicWidth}
          height={intrinsicHeight}
          decoding="async"
          draggable={false}
          className={`${heightClass} object-contain block`}
        />
      </picture>

      {/* Versão para Dark Mode (branco + lilás oficial) */}
      <picture className="hidden dark:inline-flex items-center">
        <source srcSet={darkWebp} type="image/webp" />
        <img
          src={darkPng}
          alt="DevEssent"
          width={intrinsicWidth}
          height={intrinsicHeight}
          decoding="async"
          draggable={false}
          className={`${heightClass} object-contain block`}
        />
      </picture>
    </span>
  );
}

