// Public home page. Readable by guests and signed-in users alike —
// previously this path redirected anyone with a session straight to
// /dashboard, which meant a signed-in visitor could never reach the
// company site. It now renders for everyone and offers a dashboard link.
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Icon } from "@/components/ui/Icon";
import { CtaBand, Section, SectionHeading } from "@/components/public/Sections";
import {
  INDUSTRIES,
  MISSION,
  SERVICES,
  SITE,
  VISION,
  WHY_CHOOSE_US,
} from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description:
    "Infosec consultancy for Nigerian businesses: vulnerability assessments, penetration testing, SOC management, cybersecurity audits, and hands-on bootcamp training.",
};

export default async function PublicHome() {
  const session = await auth();

  return (
    <>
      {/* Hero */}
      <section className="bg-hero text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            {SITE.tagline}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            We help businesses get secured and stay compliant.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
            KnightLead is an infosec consultancy focused on three things: find the gaps, meet
            compliance, and train your people. Security assessments, compliance support, SOC
            services, and staff training — all tailored for how companies actually work.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/contact"
              className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-ink shadow-[var(--shadow-pop)] transition-colors hover:bg-accent-600 hover:text-white"
            >
              Talk to us
            </Link>
            <Link
              href="/bootcamps"
              className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Cybersecurity bootcamps
            </Link>
            <Link
              href="/about"
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
            >
              About KnightLead
            </Link>
          </div>
          {session?.user && (
            <p className="mt-6 text-sm text-white/75">
              You are signed in.{" "}
              <Link href="/dashboard" className="font-semibold text-white underline underline-offset-4">
                Go to your dashboard
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* Three pillars */}
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Find the gaps", body: "Vulnerability assessments, penetration testing, and independent audits mapped to your real environment." },
            { title: "Meet compliance", body: "Aligned with international best practices and frameworks — GDPR, ISO 27001, and the Nigeria Data Protection Act." },
            { title: "Train your people", body: "Hands-on bootcamps and awareness training that turn staff into your first line of defence." },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className="card-hover rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <h2 className="text-lg font-bold tracking-tight text-ink">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{pillar.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Services */}
      <Section className="border-t border-line bg-surface">
        <SectionHeading
          eyebrow="Our services"
          title="Protection across your entire digital estate"
          description="From VAPT to 24/7 SOC to security awareness programmes — security made practical for Nigerian businesses."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.slug}
              className="card-hover rounded-2xl border border-line bg-surface-muted p-6"
            >
              <h3 className="text-base font-bold tracking-tight text-ink">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{service.blurb}</p>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/bootcamps"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            See training and services in detail
            <Icon.ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      {/* Vision & mission */}
      <Section className="border-t border-line">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border-l-brand rounded-r-xl bg-surface py-6 pl-6 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
              Our vision
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink">{VISION}</p>
          </div>
          <div className="border-l-accent rounded-r-xl bg-surface py-6 pl-6 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700">
              Our mission
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink">{MISSION}</p>
          </div>
        </div>
      </Section>

      {/* Why choose us */}
      <Section className="border-t border-line bg-surface">
        <SectionHeading
          eyebrow="Why choose KnightLead"
          title="Built around how security actually works"
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-surface-muted p-5">
              <h3 className="text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Industries */}
      <Section className="border-t border-line">
        <SectionHeading
          eyebrow="Industries"
          title="Tailored to your sector, size, and risk profile"
        />
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {INDUSTRIES.map((industry) => (
            <li
              key={industry}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-[var(--shadow-card)]"
            >
              {industry}
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand />
    </>
  );
}