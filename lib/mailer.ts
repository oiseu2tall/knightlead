// Mailer abstraction. Pluggable: console in dev, SMTP/Resend in prod.
// We intentionally keep this thin so swapping providers is one import change.

type SendArgs = { to: string; subject: string; html: string; text: string };

export interface Mailer {
  send(args: SendArgs): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send({ to, subject, text }: SendArgs) {
    // eslint-disable-next-line no-console
    console.log(`[mail] to=${to} subject=${subject}\n${text}\n`);
  }
}

/**
 * Resend HTTP API mailer. No SDK needed — POSTs to /emails with a
 * pre-built HTML body. Uses fetch, available in Node 18+ and the Edge.
 */
class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string) {}
  async send({ to, subject, html, text }: SendArgs) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
  }
}

let _mailer: Mailer | null = null;
export function getMailer(): Mailer {
  if (_mailer) return _mailer;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "noreply@example.com";
  _mailer = key ? new ResendMailer(key, from) : new ConsoleMailer();
  return _mailer;
}
