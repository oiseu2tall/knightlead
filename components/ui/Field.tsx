import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, type ReactNode } from "react";

const baseField =
  "block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 " +
  "disabled:opacity-60";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
};

export function Field({ label, name, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[baseField, invalid ? "border-red-500 focus:ring-red-500/30" : "", className].join(" ")}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = "", invalid, rows = 5, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={[baseField, "resize-y", invalid ? "border-red-500 focus:ring-red-500/30" : "", className].join(" ")}
      {...rest}
    />
  );
});
