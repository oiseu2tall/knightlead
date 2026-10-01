"use client";

// Contact form that composes a mailto: link. There's no inbound mail
// provider wired up, so this is the one path that genuinely delivers a
// message without inventing a backend: it hands the visitor their own mail
// client with the enquiry pre-filled. Swap for a real submit handler when
// an SMTP or transactional-email provider is configured.

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SITE } from "@/lib/site";

const ENQUIRY_TYPES = [
  "Security assessment / VAPT",
  "Penetration testing",
  "SOC management",
  "Cybersecurity audit",
  "Awareness training",
  "Bootcamp enrolment",
  "Something else",
];

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [topic, setTopic] = useState(ENQUIRY_TYPES[0]);
  const [message, setMessage] = useState("");

  const mailtoHref = () => {
    const subject = encodeURIComponent(`[${topic}] enquiry from ${name || "website visitor"}`);
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Organisation: ${organisation || "-"}`,
        "",
        message,
      ].join("\n"),
    );
    return `mailto:${SITE.email}?subject=${subject}&body=${body}`;
  };

  const complete = Boolean(name.trim() && email.trim() && message.trim());

  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={(e) => {
        // Hand off to the visitor's mail client rather than navigating away.
        e.preventDefault();
        window.location.href = mailtoHref();
      }}
    >
      <div>
        <h2 className="text-lg font-bold tracking-tight text-ink">Send us a message</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Fill this in and we will open your email app with everything filled in — then just press
          send.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name">
          <Input
            id="name"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Work email" name="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organisation" name="organisation">
          <Input
            id="organisation"
            name="organisation"
            autoComplete="organization"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="Company or institution"
          />
        </Field>
        <Field label="What is this about?" name="topic">
          <select
            id="topic"
            name="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {ENQUIRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" name="message">
        <Textarea
          id="message"
          name="message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your environment, your risks, or what you want your people to be able to do."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={!complete}>
          <Icon.Article className="h-4 w-4" />
          Open in email app
        </Button>
        {!complete && (
          <p className="text-xs text-ink-muted">Add your name, email, and a message to continue.</p>
        )}
      </div>

      <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
        Prefer to write directly?{" "}
        <a href={`mailto:${SITE.email}`} className="font-semibold text-brand-600 hover:underline">
          {SITE.email}
        </a>
      </p>
    </form>
  );
}