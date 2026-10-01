"use client";

// Public site header. Client-side only because it tracks the current route
// for the active nav state and toggles the mobile menu.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/public/Logo";
import { NAV_LINKS, SITE } from "@/lib/site";

export function PublicHeader({ accountHref }: { accountHref: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Exact match for "/" so the Home item isn't highlighted on every page.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          <Logo height={36} priority />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-ink">
              KnightLead
            </span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Cybersecurity Solutions
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                  : "text-ink-muted hover:bg-surface-dim hover:text-ink",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href={accountHref}
            className="hidden rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 sm:inline-flex"
          >
            {accountHref === "/login" ? "Sign in" : "Dashboard"}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-dim md:hidden"
          >
            {open ? <Icon.Close className="h-5 w-5" /> : <Icon.Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={[
                    "block rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive(link.href)
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                      : "text-ink hover:bg-surface-dim",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-lg bg-brand-500 px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            {accountHref === "/login" ? "Sign in" : "Dashboard"}
          </Link>
        </nav>
      )}

      <span className="sr-only">{SITE.tagline}</span>
    </header>
  );
}