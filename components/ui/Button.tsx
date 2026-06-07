// Tiny design-system primitives — Tailwind only, no extra deps.
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-500/50",
  accent:
    "bg-accent-500 text-ink hover:bg-accent-600 hover:text-white active:bg-accent-700 active:text-white disabled:bg-accent-500/50",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-dim",
  ghost:
    "bg-transparent text-ink hover:bg-surface-dim",
  danger:
    "bg-red-600 text-white hover:bg-red-700",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-xl",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
