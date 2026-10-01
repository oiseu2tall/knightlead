// /about — introduction, vision & mission, why choose us, and the
// co-founders. Public: no session required.
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CtaBand, IntroBand, Section, SectionHeading } from "@/components/public/Sections";
import { INDUSTRIES, LEADERS, MISSION, SITE, VISION, WHY_CHOOSE_US } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us — KnightLead Solutions",
  description:
    "KnightLead is a cybersecurity education and defense consultancy. Meet the co-founders, read our vision and mission, and see why clients choose us.",
};

export default function AboutPage() {
  return (
    <>
      <IntroBand eyebrow="About us" title="Security that protects what you are building">
        <p>
          I help businesses get secured and stay compliant. At Knightlead, we are an infosec
          consultancy focused on three things: find the gaps, meet compliance, and train your
          people.
        </p>
        <p>
          We provide security assessments, compliance support, SOC services, and staff training —
          all tailored for how companies actually work. From VAPT to 24/7 SOC to security awareness
          programmes, we make security practical for Nigerian businesses.
        </p>
        <p className="font-semibold text-white">
          Security should not slow you down. It should protect what you are building.
        </p>
      </IntroBand>

      {/* Vision & mission */}
      <Section>
        <SectionHeading eyebrow="What drives us" title="Vision and mission" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="border-l-brand rounded-r-xl bg-surface py-6 pl-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Icon.Sparkle className="h-4 w-4 text-brand-600" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
                Vision
              </p>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink">{VISION}</p>
          </div>
          <div className="border-l-accent rounded-r-xl bg-surface py-6 pl-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Icon.ArrowRight className="h-4 w-4 text-accent-600" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700">
                Mission
              </p>
            </div>
            <p className="mt-3 text-base leading-relaxed text-ink">{MISSION}</p>
          </div>
        </div>
      </Section>

      {/* Why choose us */}
      <Section className="border-t border-line bg-surface">
        <SectionHeading
          eyebrow="Why choose KnightLead"
          title="Five reasons clients come back"
        />
        <ul className="mt-8 space-y-4">
          {WHY_CHOOSE_US.map((item, i) => (
            <li
              key={item.title}
              className="card-hover flex gap-4 rounded-2xl border border-line bg-surface-muted p-5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold tracking-tight text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Team */}
      <Section className="border-t border-line">
        <SectionHeading
          eyebrow="Our team"
          title="Meet the professionals behind KnightLead"
          description="Certified cybersecurity professionals with global experience in defense, compliance, and training."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {LEADERS.map((leader) => (
            <article
              key={leader.name}
              className="card-hover rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-4">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white"
                  aria-hidden="true"
                >
                  {leader.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold tracking-tight text-ink">{leader.name}</h3>
                  <p className="text-sm text-ink-muted">{leader.role} @ {SITE.legalName}</p>
                </div>
              </div>
              {leader.bio && (
                <p className="mt-4 text-sm leading-relaxed text-ink-muted">{leader.bio}</p>
              )}
              <ul className="mt-4 flex flex-wrap gap-2">
                {leader.credentials.map((credential) => (
                  <li
                    key={credential}
                    className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                  >
                    {credential}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      {/* Clients & partners */}
      <Section className="border-t border-line bg-surface">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHeading
              eyebrow="Clients & partners"
              title="Trusted across regulated and high-risk sectors"
              description="Our strategies are customised to each client's industry, size, and risk profile."
            />
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {INDUSTRIES.map((industry) => (
                <li
                  key={industry}
                  className="rounded-full border border-line bg-surface-muted px-4 py-2 text-sm font-medium text-ink"
                >
                  {industry}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface-muted p-6">
            <h3 className="text-base font-bold tracking-tight text-ink">Work with us</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Whether you need a gap assessment, ongoing SOC coverage, or a trained team, we can
              help you work out where to start.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Get in touch
              <Icon.ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Let us find your gaps"
        body="Book a conversation with the KnightLead team about assessments, compliance support, SOC services, or staff training."
      />
    </>
  );
}