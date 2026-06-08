// EmptyState — used wherever a list is empty. Keeps the visual
// language consistent (centered card, muted ink, optional CTA).
import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?:
    | { label: string; href: string }
    | { label: string; onClick: () => void };
  className?: string;
};

export function EmptyState({
  icon = "Empty",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const I = Icon[icon];
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center",
        className,
      ].join(" ")}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-200">
        <I className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && "href" in action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          {action.label}
        </Link>
      ) : action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
