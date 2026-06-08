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
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        <nav aria-label="Section" className="flex min-w-0 items-center gap-1">
          {tabs.map((t) => {
            const I = Icon[t.icon];
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-brand-600 dark:text-brand-200"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                <I className="h-4 w-4" />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className="rounded-full bg-surface-dim px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
                    {t.count}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-opacity",
                    active
                      ? "bg-brand-500 opacity-100"
                      : "bg-brand-500 opacity-0 group-hover:opacity-50",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {(["all", "ACTIVE", "COMPLETED"] as const).map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(s)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                    : "border-line bg-surface text-ink-muted hover:bg-surface-dim",
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
