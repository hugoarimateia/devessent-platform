import * as React from "react";
import { BrandLogo, type BrandLogoProps } from "./brand-logo";

export { BrandLogo, type BrandLogoProps };

interface DevEssentMarkProps {
  size?: number;
  className?: string;
}

/**
 * Símbolo geométrico oficial da DevEssent renderizado a partir do asset original da marca.
 */
export function DevEssentMark({ size = 24, className = "" }: DevEssentMarkProps) {
  const sizeVariant = size >= 28 ? "lg" : size <= 22 ? "sm" : "md";
  return <BrandLogo compact size={sizeVariant} className={className} />;
}

/**
 * Assinatura institucional oficial DevEssent (Símbolo geométrico + Wordmark original).
 * Mantém compatibilidade com importações existentes delegando integralmente para `BrandLogo`.
 */
export function DevEssentWordmark(props: BrandLogoProps) {
  return <BrandLogo {...props} />;
}
