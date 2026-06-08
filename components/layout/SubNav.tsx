"use client";

// SubNav — a sticky horizontal sub-navigation that sits below the
// dashboard app bar. Designed for sections like /admin/** that have
// multiple sibling pages and benefit from persistent quick navigation.
//
// Two variants:
//   - `tabs`   : pill-style segmented control. Use when pages are
//                same-level and switching is fast.
//   - `menubar`: underlined links (classic menubar). Use when there
//                are many items or you want a more traditional feel.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type SubNavItem = {
  href: string;
  label: string;
  icon?: IconName;
  /** If set, the link is "active" when the pathname starts with this
   *  value (defaults to `href`). Set to `false` to require exact match. */
  matchPrefix?: boolean | string;
  /** Optional badge count (e.g. "Pending: 3"). Rendered as a small
   *  pill on the right of the label. */
  badge?: ReactNode;
};

type SubNavProps = {
  items: SubNavItem[];
  variant?: "tabs" | "menubar";
  /** Optional trailing element (e.g. a search input or "+ New" button). */
  trailing?: ReactNode;
};

export function SubNav({ items, variant = "menubar", trailing }: SubNavProps) {
  const pathname = usePathname();

  return (
    <div
      className={[
        "sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-surface/85 px-4 backdrop-blur sm:-mx-6 sm:px-6",
        variant === "tabs" ? "py-2" : "py-1",
      ].join(" ")}
    >
      <div className="flex items-center gap-1 overflow-x-auto">
        <nav
          aria-label="Section"
          className={[
            "flex min-w-0 items-center gap-1",
            variant === "tabs" ? "rounded-xl border border-line bg-surface-muted p-1" : "",
          ].join(" ")}
        >
          {items.map((item) => {
            const I = item.icon ? Icon[item.icon] : null;
            const active = isActive(pathname, item.href, item.matchPrefix);
            if (variant === "tabs") {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface text-ink shadow-[var(--shadow-card)]"
                      : "text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  {I && <I className="h-4 w-4" />}
                  <span>{item.label}</span>
                  {item.badge}
                </Link>
              );
            }
            // menubar variant — underlined
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-brand-600 dark:text-brand-200"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {I && <I className="h-4 w-4" />}
                <span>{item.label}</span>
                {item.badge}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-opacity",
                    active ? "bg-brand-500 opacity-100" : "bg-brand-500 opacity-0 group-hover:opacity-50",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
        {trailing && <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string, matchPrefix?: boolean | string): boolean {
  if (pathname === href) return true;
  if (matchPrefix === false) return false;
  if (matchPrefix === undefined || matchPrefix === true) {
    return pathname.startsWith(href + "/");
  }
  if (typeof matchPrefix === "string") {
    return pathname.startsWith(matchPrefix);
  }
  return false;
}
