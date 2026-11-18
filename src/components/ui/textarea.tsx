import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={twMerge(
          clsx(
            "w-full px-3.5 py-2.5 rounded-[10px] bg-surface border text-foreground placeholder:text-foreground-muted/65 text-base sm:text-sm leading-relaxed transition-colors focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed min-h-[88px]",
            error
              ? "border-red-500 focus:ring-red-500/35"
              : "border-[#CBD2E1] dark:border-[#2C3347] hover:border-foreground-muted/60",
            className
          )
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
