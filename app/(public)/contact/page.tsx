// /contact — direct contact channels from the company profile plus an
// enquiry form. Public: no session required.
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ContactForm } from "@/components/public/ContactForm";
import { IntroBand, Section, SectionHeading } from "@/components/public/Sections";
import { SITE, SERVICES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us — KnightLead Solutions",
  description:
    "Get in touch with KnightLead Solutions about cybersecurity assessments, penetration testing, SOC management, audits, and bootcamp training.",
};

const CHANNELS = [
  {
    icon: "Article" as const,
    label: "Email",
    value: SITE.email,
    href: `mailto:${SITE.email}`,
    hint: "Best for detailed enquiries and document sharing.",
  },
  {
    icon: "Clock" as const,
    label: "Phone",
    value: SITE.phone,
    href: `tel:${SITE.phoneHref}`,
    hint: "Speak to the team directly.",
  },
  {
    icon: "ExternalLink" as const,
    label: "Website",
    value: SITE.website.replace(/^https?:\/\//, ""),
    href: SITE.website,
    hint: "More about our work and services.",
  },
];

export default function ContactPage() {
  return (
    <>
      <IntroBand eyebrow="Contact" title="Talk to the KnightLead team">
        <p>
          Tell us what you are trying to protect and where you think the risk is. We will help you
          work out whether you need an assessment, ongoing monitoring, compliance support, or a
          team that can respond.
        </p>
      </IntroBand>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Channels */}
          <div>
            <SectionHeading eyebrow="Reach us" title="Direct contact" />

            <ul className="mt-6 space-y-3">
              {CHANNELS.map((channel) => {
                const ChannelIcon = Icon[channel.icon];
                return (
                  <li key={channel.label}>
                    <a
                      href={channel.href}
                      className="card-hover flex items-start gap-4 rounded-2xl border border-line bg-surface p-4"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                        <ChannelIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                          {channel.label}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                          {channel.value}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                          {channel.hint}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 rounded-2xl border border-line bg-surface-muted p-5">
              <h2 className="text-base font-bold tracking-tight text-ink">Useful to include</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                {[
                  "Your industry and approximate size",
                  "Systems or data that matter most",
                  "Whether there is a compliance deadline",
                  "How many people need training, and their level",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form */}
          <ContactForm />
        </div>
      </Section>

      {/* Service shortcuts */}
      <Section className="border-t border-line bg-surface">
        <SectionHeading
          eyebrow="What we do"
          title="Or jump straight to a service"
        />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.slug}>
              <Link
                href="/bootcamps"
                className="card-hover flex h-full flex-col rounded-2xl border border-line bg-surface-muted p-5"
              >
                <span className="text-sm font-bold text-ink">{service.title}</span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-muted">
                  {service.blurb}
                </span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  Learn more
                  <Icon.ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}