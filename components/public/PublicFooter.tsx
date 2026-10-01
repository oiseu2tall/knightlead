// Public site footer — contact details repeated from lib/site so visitors
// can reach the company from any page.

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/public/Logo";
import { NAV_LINKS, SERVICES, SITE } from "@/lib/site";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <Logo height={44} />
              <span>
                <span className="block text-sm font-bold tracking-tight text-ink">KnightLead</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Cybersecurity Solutions
                </span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">{SITE.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Security should not slow you down. It should protect what you are building.
            </p>
          </div>

          <nav aria-labelledby="footer-nav">
            <h2 id="footer-nav" className="text-xs font-semibold uppercase tracking-wider text-ink">
              Company
            </h2>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-muted hover:text-brand-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">Services</h2>
            <ul className="mt-4 space-y-2.5">
              {SERVICES.map((service) => (
                <li key={service.slug}>
                  <Link
                    href="/bootcamps"
                    className="text-sm text-ink-muted hover:text-brand-600"
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">Contact</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-flex items-start gap-2 hover:text-brand-600"
                >
                  <Icon.Article className="mt-0.5 h-4 w-4 shrink-0" />
                  {SITE.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${SITE.phoneHref}`}
                  className="inline-flex items-start gap-2 hover:text-brand-600"
                >
                  <Icon.Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  {SITE.phone}
                </a>
              </li>
              <li className="inline-flex items-start gap-2">
                <Icon.ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                {SITE.website.replace(/^https?:\/\//, "")}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            &copy; {year} {SITE.legalName}. All rights reserved.
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {SITE.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}