// Email verification — issue, send, and consume a VerificationToken.
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getMailer } from "@/lib/mailer";

const TOKEN_TTL_HOURS = 24;

export async function createVerificationToken(userId: string): Promise<string> {
  // Wipe any previous unused tokens for this user to keep things tidy.
  await db.verificationToken.deleteMany({
    where: { identifier: `verify:${userId}` },
  });

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await db.verificationToken.create({
    data: { identifier: `verify:${userId}`, token, expires },
  });

  // Email it. Failures here don't poison the user record.
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (user) {
    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    const url = `${base}/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(userId)}`;
    await getMailer().send({
      to: user.email,
      subject: "Verify your Bootcamp LMS email",
      text: `Hi ${user.name ?? "there"},\n\nConfirm your email by opening: ${url}\n\nThis link expires in ${TOKEN_TTL_HOURS} hours.`,
      html: `<p>Hi ${escapeHtml(user.name ?? "there")},</p>
<p>Confirm your email by clicking the link below:</p>
<p><a href="${url}">Verify email</a></p>
<p>This link expires in ${TOKEN_TTL_HOURS} hours.</p>`,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[mail] verification send failed:", e);
    });
  }
  return token;
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; error: "expired" | "invalid" };

export async function consumeVerificationToken(
  userId: string,
  token: string,
): Promise<ConsumeResult> {
  const row = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: `verify:${userId}`, token } },
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.expires < new Date()) {
    await db.verificationToken.delete({ where: { identifier_token: { identifier: `verify:${userId}`, token } } });
    return { ok: false, error: "expired" };
  }
  // Mark user verified; single-use token.
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  await db.verificationToken.delete({ where: { identifier_token: { identifier: `verify:${userId}`, token } } });
  return { ok: true, userId };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
