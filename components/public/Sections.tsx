// Shared marketing-page building blocks. Small on purpose — these exist so
// the four public pages share one rhythm (section width, heading scale,
// dark hero band, closing CTA) instead of each inventing its own.

import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Full-bleed dark band used for the intro paragraph on each page. */
export function IntroBand({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-hero text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <div className="mt-5 max-w-3xl space-y-4 text-base leading-relaxed text-white/85 sm:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={["max-w-2xl", centered ? "mx-auto text-center" : ""].join(" ")}>
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-base leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/** Bullet list with accent ticks — reused for service points and features. */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Closing call to action, repeated at the bottom of every public page. */
export function CtaBand({
  title = "Ready to find your gaps?",
  body = "Talk to us about a security assessment, compliance support, SOC services, or staff training tailored to how your organisation actually works.",
  primary = { href: "/contact", label: "Contact us" },
  secondary = { href: "/bootcamps", label: "Explore our training" },
}: {
  title?: string;
  body?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="bg-hero">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
            <p className="mt-3 text-base leading-relaxed text-white/85">{body}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href={primary.href}
              className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-ink shadow-[var(--shadow-pop)] transition-colors hover:bg-accent-600 hover:text-white"
            >
              {primary.label}
            </Link>
            <Link
              href={secondary.href}
              className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}