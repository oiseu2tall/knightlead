import type { ReactNode } from "react";
import { isRole, ROLE_META, roleLabel } from "@/lib/role";

export function Card({
  children,
  className = "",
  tinted = false,
}: {
  children: ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-line p-6 shadow-[var(--shadow-card)]",
        tinted ? "card-tinted" : "bg-surface",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  accent = "brand",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Optional eyebrow rendered above the title — used to surface the
   * role context on dashboard sub-pages, e.g. "TEACH · GRADING".
   */
  eyebrow?: ReactNode;
  /**
   * The left accent color of the title. `brand` (default), `accent`,
   * or `none` (no bar).
   */
  accent?: "brand" | "accent" | "none";
}) {
  const accentBar =
    accent === "none"
      ? ""
      : accent === "accent"
        ? "before:bg-accent-500"
        : "before:bg-brand-500";
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {eyebrow}
          </div>
        )}
        <h1
          className={[
            "relative pl-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl",
            accent === "none" ? "" : `before:absolute before:left-0 before:top-1.5 before:h-6 before:w-1 before:rounded-r-full ${accentBar}`,
          ].join(" ")}
        >
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "brand" | "accent";
}) {
  const accent =
    tone === "brand" ? "border-l-brand" :
    tone === "accent" ? "border-l-accent" : "";
  return (
    <Card className={["card-hover pl-5", accent].join(" ")}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </Card>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-dim"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-hero transition-[width] duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-dim text-ink-muted",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger:  "bg-red-100 text-red-800",
    info:    "bg-brand-100 text-brand-700",
    accent:  "bg-accent-100 text-accent-800",
  } as const;
  return (
    <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className].join(" ")}>
      {children}
    </span>
  );
}

/**
 * Role pill. Renders a single role string in the brand palette that
 * corresponds to it. Use this anywhere you show a user's role — the
 * sidebar identity block, the admin user table, profile cards, etc.
 * `size` controls density: "sm" inside tables, "md" for headers.
 */
export function RoleBadge({
  role,
  size = "md",
  className = "",
}: {
  role: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = isRole(role) ? ROLE_META[role] : null;
  const sizeCls =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider",
        sizeCls,
        meta?.badgeClass ?? "bg-surface-dim text-ink-muted ring-1 ring-inset ring-line",
        className,
      ].join(" ")}
    >
      {roleLabel(role)}
    </span>
  );
}
