import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={twMerge(
          clsx(
            "w-full min-h-[44px] px-3.5 py-2 rounded-[10px] bg-surface border text-foreground placeholder:text-foreground-muted/65 text-base sm:text-sm leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 focus:ring-red-500/35 focus:border-red-500"
              : "border-[#CBD2E1] dark:border-[#2C3347] hover:border-foreground-muted/60",
            className
          )
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
