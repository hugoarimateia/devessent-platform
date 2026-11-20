"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Wrapper de revelação progressiva por rolagem (IntersectionObserver).
 * - Mantém o conteúdo presente e acessível sem JavaScript.
 * - Verifica prefers-reduced-motion antes de aplicar transição de entrada.
 * - Anima apenas opacity e transform (compositor thread).
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"static" | "hidden" | "visible">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersMotion = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;

    if (!prefersMotion || typeof IntersectionObserver === "undefined") {
      setState("static");
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      setState("visible");
      return;
    }

    setState("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -36px 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const revealClass =
    state === "hidden"
      ? "de-reveal-ready"
      : state === "visible"
      ? "de-reveal-ready de-reveal-visible"
      : "";

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`${revealClass} ${className}`}
    >
      {children}
    </div>
  );
}

