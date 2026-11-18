import * as React from "react";
import { Label } from "./label";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}

