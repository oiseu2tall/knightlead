// Mailer abstraction:
//   1. Resend API (if RESEND_API_KEY is set)
//   2. Gmail SMTP (if EMAIL_ADDRESS + EMAIL_APP_PASSWORD are set)
//   3. Nodemailer SMTP URL (if NODEMAILER_URL is set)
//   4. Ethereal test inbox (development only)
//   5. Console fallback (development only — logs to stdout)
//
// In production, a real mailer must be configured or delivery fails loudly.

type SendArgs = { to: string; subject: string; html: string; text: string };

export interface Mailer {
  send(args: SendArgs): Promise<void>;
  name: string;
}

class ResendMailer implements Mailer {
  name = "resend";

  constructor(private apiKey: string, private from: string) {}

  async send({ to, subject, html, text }: SendArgs) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, html, text }),
    });

    if (!response.ok) {
      throw new Error(`Resend API request failed with status ${response.status}`);
    }
  }
}

class NodemailerMailer implements Mailer {
  name: string;
  constructor(private transporter: import("nodemailer").Transporter, private from: string, label: string) {
    this.name = label;
  }
  async send({ to, subject, html, text }: SendArgs) {
    await this.transporter.sendMail({ from: this.from, to, subject, html, text });
  }
}

class EtherealMailer implements Mailer {
  name = "ethereal";
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

class ConsoleMailer implements Mailer {
  name = "console";
  async send({ to, subject, html, text }: SendArgs) {
    console.log(`\n[mail] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[mail] To: ${to}`);
    console.log(`[mail] Subject: ${subject}`);
    console.log(`[mail] Text: ${text}`);
    console.log(`[mail] Html: ${html}`);
    console.log(`[mail] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

/**
 * Tries a chain of mailers in order. Tracks which mailer actually
 * delivered so callers can detect if only a dev fallback was used.
 */
class FallbackMailer implements Mailer {
  name = "fallback";
  private chain: Mailer[];
  lastUsed: Mailer | null = null;

  constructor(chain: Mailer[]) {
    this.chain = chain;
  }

  async send(args: SendArgs) {
    let lastError: unknown;
    for (const mailer of this.chain) {
      try {
        await mailer.send(args);
        this.lastUsed = mailer;
        return; // success — stop trying
      } catch (e) {
        lastError = e;
        console.warn(`[mail] ${mailer.name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    this.lastUsed = null;
    throw lastError ?? new Error("All mailers exhausted");
  }

  isRealMailer(): boolean {
    return this.lastUsed ? this.lastUsed.name !== "console" && this.lastUsed.name !== "ethereal" : false;
  }
}

let _mailer: FallbackMailer | null = null;
export async function getMailer(): Promise<FallbackMailer> {
  if (_mailer) return _mailer;
  const from = process.env.MAIL_FROM ?? process.env.EMAIL_ADDRESS ?? "noreply@example.com";
  const chain: Mailer[] = [];
  const isDev = process.env.NODE_ENV !== "production";

  // 1. Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    if (!process.env.MAIL_FROM) {
      throw new Error("MAIL_FROM must be set to a sender address verified with Resend.");
    }
    chain.push(new ResendMailer(resendApiKey, from));
  }

  // 2. Gmail SMTP via Nodemailer
  const gmailUser = process.env.EMAIL_ADDRESS;
  const gmailPass = process.env.EMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE !== "false",
      auth: { user: gmailUser, pass: gmailPass },
    });
    chain.push(new NodemailerMailer(transporter, from, "gmail"));
  }

  // 3. Nodemailer SMTP URL (if explicitly set)
  if (process.env.NODEMAILER_URL) {
    const nodemailer = await import("nodemailer");
    chain.push(new NodemailerMailer(nodemailer.createTransport(process.env.NODEMAILER_URL), from, "nodemailer-url"));
  }

  if (isDev) {
    // 4. Ethereal fallback (local dev with real inbox)
    chain.push(new EtherealMailer());

    // 5. Console fallback (always succeeds — dev safety net)
    chain.push(new ConsoleMailer());
  } else if (chain.length === 0) {
    throw new Error(
      "No email transport configured for production. Set RESEND_API_KEY, EMAIL_ADDRESS + EMAIL_APP_PASSWORD " +
      "for Gmail SMTP, or NODEMAILER_URL for a custom SMTP server.",
    );
  }

  _mailer = new FallbackMailer(chain);
  return _mailer;
}

export function isProductionMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) ||
    Boolean(process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD) ||
    Boolean(process.env.NODEMAILER_URL);
}
