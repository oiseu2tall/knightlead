// /bootcamps — the cybersecurity bootcamp programme plus the wider service
// catalogue, since the profile presents training as service #1. Public:
// no session required.
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CheckList, CtaBand, IntroBand, Section, SectionHeading } from "@/components/public/Sections";
import { PENETRATION_TESTING_AREAS, SERVICES, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cybersecurity Bootcamps & Training — KnightLead Solutions",
  description:
    "Intensive, hands-on cybersecurity bootcamps engineered to bridge the talent shortage, plus VAPT, penetration testing, SOC management, audits, and awareness training.",
};

export default function BootcampsPage() {
  const bootcamp = SERVICES.find((s) => s.slug === "cybersecurity-bootcamp-trainings")!;
  const otherServices = SERVICES.filter((s) => s.slug !== "cybersecurity-bootcamp-trainings");
  const penTest = SERVICES.find((s) => s.slug === "penetration-testing")!;

  return (
    <>
      <IntroBand eyebrow="Cybersecurity training" title="Bootcamps that build real capacity">
        <p>
          Our bootcamps are intensive, hands-on programmes engineered to bridge the critical
          talent shortage. Dedicated mentorship throughout, so every graduate emerges with the
          technical capacity and confidence to protect enterprises in a connected world.
        </p>
      </IntroBand>

      {/* What makes the programme different */}
      <Section>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Hands-on, not theory",
              body: "Real labs and real tooling. You practise the work, not just the vocabulary.",
            },
            {
              title: "Dedicated mentorship",
              body: "Guided by practising cybersecurity professionals throughout the programme.",
            },
            {
              title: "Career-ready graduates",
              body: "Every graduate leaves with the confidence to protect enterprises in a connected world.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="card-hover rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                <Icon.Sparkle className="h-4.5 w-4.5" />
              </div>
              <h2 className="mt-4 text-base font-bold tracking-tight text-ink">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Curriculum coverage */}
      <Section className="border-t border-line bg-surface">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Curriculum coverage"
              title="Skills our programmes are built around"
            />
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {PENETRATION_TESTING_AREAS.map((area) => (
                <li
                  key={area}
                  className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3 text-sm font-medium text-ink"
                >
                  <Icon.Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {area}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface-muted p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
              Programme summary
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">{bootcamp.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{bootcamp.blurb}</p>
            <CheckList items={bootcamp.points} />
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Enquire about the next intake
              <Icon.ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* Wider services */}
      <Section className="border-t border-line">
        <SectionHeading
          eyebrow="Beyond training"
          title="Services that keep your people and systems protected"
          description="Training is one part of it. These services cover assessment, defence, and compliance for organisations that need a partner rather than a course."
        />
        <div className="mt-8 space-y-5">
          {otherServices.map((service) => (
            <article
              key={service.slug}
              className="card-hover rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 lg:max-w-xl">
                  <h3 className="text-lg font-bold tracking-tight text-ink">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{service.blurb}</p>
                </div>
                <div className="lg:max-w-md lg:flex-1">
                  <CheckList items={service.points} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Pen-testing coverage */}
      <Section className="border-t border-line bg-surface">
        <SectionHeading
          eyebrow="Penetration testing"
          title="We evaluate your posture from an adversary's perspective"
          description={penTest.blurb}
        />
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-muted">
          Multi-layered testing pairs automated tooling with manual craft — the weaknesses that
          automated testing approaches frequently miss.
        </p>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PENETRATION_TESTING_AREAS.map((area) => (
            <li
              key={area}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3 text-sm font-medium text-ink"
            >
              <Icon.Check className="h-4 w-4 shrink-0 text-brand-500" />
              {area}
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Ask about the next intake"
        body={`Cohorts run throughout the year. Reach the KnightLead team at ${SITE.email} or ${SITE.phone}.`}
        primary={{ href: "/contact", label: "Contact us" }}
        secondary={{ href: "/about", label: "Meet the team" }}
      />
    </>
  );
}