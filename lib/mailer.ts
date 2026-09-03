// Mailer abstraction. Pluggable: Resend in prod, Ethereal in dev,
// Nodemailer SMTP if explicitly configured.
// We intentionally keep this thin so swapping providers is one import change.

type SendArgs = { to: string; subject: string; html: string; text: string };

export interface Mailer {
  send(args: SendArgs): Promise<void>;
}

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

/**
 * Nodemailer SMTP mailer. Use when NODEMAILER_URL is set.
 */
class NodemailerMailer implements Mailer {
  constructor(private transporter: import("nodemailer").Transporter) {}
  async send({ to, subject, html, text }: SendArgs) {
    await this.transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
  }
}

/**
 * Ethereal mailer — creates a throwaway test account and sends via
 * Nodemailer. Prints the inbox URL to the console so you can click
 * through and view the message. Great for local development when Resend
 * is not configured or the from-domain is unverified.
 */
class EtherealMailer implements Mailer {
  private transporter: import("nodemailer").Transporter | null = null;

  async send({ to, subject, html, text }: SendArgs) {
    if (!this.transporter) {
      const nodemailer = await import("nodemailer");
      const account = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
      console.log(`[mail] Using Ethereal test account: ${account.user}`);
    }
    const info = await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? "noreply@example.com",
      to,
      subject,
      html,
      text,
    });
    const url = (this.transporter as unknown as { getTestMessageUrl: (info: { url?: string }) => string }).getTestMessageUrl(info);
    console.log(`[mail] Ethereal preview: ${url}`);
  }
}

let _mailer: Mailer | null = null;
export async function getMailer(): Promise<Mailer> {
  if (_mailer) return _mailer;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "noreply@example.com";

  if (key) {
    _mailer = new ResendMailer(key, from);
    return _mailer;
  }

  if (process.env.NODEMAILER_URL) {
    const nodemailer = await import("nodemailer");
    _mailer = new NodemailerMailer(nodemailer.createTransport(process.env.NODEMAILER_URL));
    return _mailer;
  }

  _mailer = new EtherealMailer();
  return _mailer;
}

let _fallback: Mailer | null = null;

/**
 * Returns a mailer that tries the configured primary provider (Resend,
 * Nodemailer SMTP) and, if it fails, falls back to Ethereal so that
 * verification emails are never silently lost during development.
 */
export async function getMailerWithFallback(): Promise<Mailer> {
  const primary = await getMailer();
  if (primary instanceof EtherealMailer) return primary;

  if (!_fallback) _fallback = new EtherealMailer();
  return new FallbackMailer(primary, _fallback);
}

class FallbackMailer implements Mailer {
  constructor(private primary: Mailer, private fallback: Mailer) {}

  async send(args: SendArgs) {
    try {
      await this.primary.send(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        "[mail] Primary provider failed — falling back to Ethereal test inbox.\n" +
          `Reason: ${msg}\n` +
          "To fix: verify your domain at https://resend.com/domains or set MAIL_FROM to a verified address.",
      );
      await this.fallback.send(args);
    }
  }
}
