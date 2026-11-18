import * as React from "react";

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      className={`space-y-3 animate-pulse ${className}`}
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 rounded-xl bg-surface-muted border border-surface-border/60"
        />
      ))}
    </div>
  );
}

