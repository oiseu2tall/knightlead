"use client";

// Tabs and filter for the student "Learn" workspace — shared between
// /dashboard/courses (My courses) and /dashboard/courses/browse.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";

type Tab = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
};

type StatusFilter = "all" | "ACTIVE" | "COMPLETED";

export function LearnTabs({ tabs, status, onStatus }: {
  tabs: Tab[];
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
}) {
  const pathname = usePathname();
  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-surface/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-1 sm:py-1">
        <nav
          aria-label="Section"
          className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted p-1 sm:flex sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
        >
          {tabs.map((t) => {
            const I = Icon[t.icon];
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative inline-flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-xs font-medium transition-colors sm:min-h-0 sm:shrink-0 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-3 sm:text-sm sm:text-left",
                  active
                    ? "bg-surface text-brand-700 shadow-[var(--shadow-card)] dark:text-brand-200 sm:bg-transparent sm:text-brand-600 sm:shadow-none"
                    : "text-ink-muted hover:bg-surface/70 hover:text-ink sm:hover:bg-transparent",
                ].join(" ")}
              >
                <I className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
                {t.count !== undefined && (
                  <span className="rounded-full bg-surface-dim px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink sm:inline-flex">
                    {t.count}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-3 -bottom-px hidden h-0.5 rounded-full transition-opacity sm:block",
                    active
                      ? "bg-brand-500 opacity-100"
                      : "bg-brand-500 opacity-0 group-hover:opacity-50",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted p-1 sm:ml-auto sm:flex sm:shrink-0 sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0">
          {(["all", "ACTIVE", "COMPLETED"] as const).map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(s)}
                className={[
                  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-lg px-1 py-1 text-center text-xs font-medium transition-colors sm:min-h-0 sm:gap-1.5 sm:rounded-full sm:border sm:px-2.5 sm:py-1",
                  active
                    ? "bg-surface text-brand-700 shadow-[var(--shadow-card)] dark:text-brand-200 sm:border-brand-500 sm:bg-brand-50 sm:shadow-none sm:dark:bg-brand-500/10"
                    : "text-ink-muted hover:bg-surface/70 sm:border-line sm:bg-surface sm:hover:bg-surface-dim",
                ].join(" ")}
              >
                {s === "all" ? "All" : s === "ACTIVE" ? "In progress" : "Completed"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function useCourseFilters<T>(
  items: T[],
  opts: {
    pickQuery: (t: T) => string[];
    pickStatus: (t: T) => string | null;
    initialQuery?: string;
  },
) {
  const [query, setQuery] = useState(opts.initialQuery ?? "");
  const [status, setStatus] = useState<StatusFilter>("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (status !== "all" && opts.pickStatus(t) !== status) return false;
      if (!q) return true;
      return opts.pickQuery(t).some((s) => s.toLowerCase().includes(q));
    });
  }, [items, query, status]);
  return {
    query, setQuery, status, setStatus, filtered,
  };
}

export function SearchControls({
  query, setQuery, placeholder,
}: {
  query: string;
  setQuery: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-4">
      <SearchInput
        placeholder={placeholder}
        aria-label="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full sm:max-w-sm"
      />
    </div>
  );
}
