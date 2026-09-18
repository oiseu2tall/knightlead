// Mailer abstraction. Uses Nodemailer exclusively:
//   1. Gmail SMTP (if EMAIL_ADDRESS + EMAIL_APP_PASSWORD are set)
//   2. Nodemailer SMTP URL (if NODEMAILER_URL is set)
//   3. Ethereal test inbox (fallback for local development)
//   4. Console fallback (logs to stdout — guarantees never to fail)
//
// Uses a FallbackMailer that tries each provider in order. If all real
// providers fail, the ConsoleMailer ensures the email content is visible
// for local development and testing.

type SendArgs = { to: string; subject: string; html: string; text: string };

export interface Mailer {
  send(args: SendArgs): Promise<void>;
  name: string;
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
    console.log(`\n[mail] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[mail] To: ${to}`);
    console.log(`[mail] Subject: ${subject}`);
    console.log(`[mail] Text: ${text}`);
    console.log(`[mail] Html: ${html}`);
    console.log(`[mail] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

/**
 * Tries a chain of mailers in order. If one fails, logs the error
 * and moves to the next. The last mailer in the chain (ConsoleMailer)
 * always succeeds, ensuring no email-sending failure blocks the user.
 */
class FallbackMailer implements Mailer {
  name = "fallback";
  private chain: Mailer[] = [];

  constructor(chain: Mailer[]) {
    this.chain = chain;
  }

  async send(args: SendArgs) {
    for (const mailer of this.chain) {
      try {
        await mailer.send(args);
        return; // success — stop trying
      } catch (e) {
        console.warn(`[mail] ${mailer.name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Should never reach here — ConsoleMailer is always last
    throw new Error("All mailers exhausted");
  }
}

let _mailer: Mailer | null = null;
export async function getMailer(): Promise<Mailer> {
  if (_mailer) return _mailer;
  const from = process.env.MAIL_FROM ?? "noreply@example.com";
  const chain: Mailer[] = [];

  // 1. Gmail SMTP via Nodemailer
  const gmailUser = process.env.EMAIL_ADDRESS;
  const gmailPass = process.env.EMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) ?? 465,
      secure: process.env.EMAIL_SECURE !== "false",
      auth: { user: gmailUser, pass: gmailPass },
    });
    chain.push(new NodemailerMailer(transporter, from, "gmail"));
  }

  // 2. Nodemailer SMTP URL (if explicitly set)
  if (process.env.NODEMAILER_URL) {
    const nodemailer = await import("nodemailer");
    chain.push(new NodemailerMailer(nodemailer.createTransport(process.env.NODEMAILER_URL), from, "nodemailer-url"));
  }

  // 3. Ethereal fallback (local dev with real inbox)
  chain.push(new EtherealMailer());

  // 4. Console fallback (always succeeds — dev safety net)
  chain.push(new ConsoleMailer());

  _mailer = new FallbackMailer(chain);
  return _mailer;
}