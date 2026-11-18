import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={twMerge(
          clsx(
            "w-full min-h-[44px] px-3.5 py-2 rounded-[10px] bg-surface border text-foreground text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 focus:ring-red-500/35"
              : "border-[#CBD2E1] dark:border-[#2C3347] hover:border-foreground-muted/60",
            className
          )
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
