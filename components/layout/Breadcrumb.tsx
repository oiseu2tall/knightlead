// Breadcrumb — a compact, semantic breadcrumb trail. Renders a list
// of items separated by a chevron. The last item is rendered as
// "current" (no link). Used inside SubNav-aware page headers.

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export type Crumb = {
  label: ReactNode;
  href?: string;
};

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <Icon.ChevronRight className="h-3 w-3 opacity-50" />}
            {c.href && !isLast ? (
              <Link href={c.href} className="rounded-sm hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined} className="font-medium text-ink">
                {c.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
