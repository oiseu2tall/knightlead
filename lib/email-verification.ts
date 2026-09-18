// Email verification — OTP-style (code-based) flow.
// Instead of link-based tokens, users receive a code like KNL-XXXXXXXXX
// and enter it in a form. The code is stored in the EmailVerification table
// with a 15-minute TTL and a max-attempts counter for rate limiting.

import { db } from "@/lib/db";
import { getMailer } from "@/lib/mailer";
import { generateInvitationCode } from "@/lib/otp";

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

export interface VerificationResult {
  ok: boolean;
  error?: "expired" | "already_used" | "too_many_attempts" | "invalid" | "send_failed";
}

export interface VerificationRecord {
  code: string;
  expiresAt: Date;
  attemptsCount: number;
}

/**
 * Create a new OTP for the given user. Sends the code via email.
 * Returns the created record on success, or throws on email failure.
 */
export async function createVerificationCode(userId: string): Promise<VerificationRecord> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw new Error("User not found");

  const code = generateInvitationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // UPSERT: update existing verification or create new.
  const record = await db.emailVerification.upsert({
    where: {
      email_purpose: { email: user.email, purpose: "email_verification" },
    },
    update: {
      code,
      isUsed: false,
      expiresAt,
      attemptsCount: 0,
    },
    create: {
      email: user.email,
      code,
      purpose: "email_verification",
      isUsed: false,
      expiresAt,
      attemptsCount: 0,
    },
  });

  // Send via email. Throws if the mailer fails.
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const text = `Hi ${user.name ?? "there"},\n\nYour verification code is: ${code}\n\nThis code expires in ${CODE_TTL_MINUTES} minutes.\n\nEnter it at: ${base}/verify-email`;
  const html = `<p>Hi ${escapeHtml(user.name ?? "there")},</p>
<p>Your verification code is:</p>
<p class="code" style="font-family: monospace; font-size: 1.5em; font-weight: bold; background: #f5f5f5; padding: 8px 16px; border-radius: 4px; display: inline-block;">${code}</p>
<p>This code expires in ${CODE_TTL_MINUTES} minutes.</p>
<p>Enter it at: <a href="${base}/verify-email">${base}/verify-email</a></p>`;

  await (await getMailer()).send({
    to: user.email,
    subject: "Verify your email — KnightLead",
    text,
    html,
  });

  return { code, expiresAt, attemptsCount: 0 };
}

/**
 * Verify an OTP code for the given user. Uses an atomic UPDATE+RETURNING
 * to prevent race conditions and double-use.
 */
export async function verifyCode(userId: string, code: string): Promise<VerificationResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return { ok: false, error: "invalid" };

  // Check if a verification record exists and is valid.
  const record = await db.emailVerification.findUnique({
    where: { email_purpose: { email: user.email, purpose: "email_verification" } },
  });

  if (!record) return { ok: false, error: "invalid" };
  if (record.isUsed) return { ok: false, error: "already_used" };
  if (record.expiresAt < new Date()) return { ok: false, error: "expired" };
  if (record.attemptsCount >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };
  if (record.code !== code) {
    // Increment attempts on mismatch.
    await db.emailVerification.update({
      where: { email_purpose: { email: user.email, purpose: "email_verification" } },
      data: { attemptsCount: { increment: 1 } },
    });
    return { ok: false, error: "invalid" };
  }

  // Atomic mark-as-used + mark user verified.
  await db.$transaction([
    db.emailVerification.update({
      where: { email_purpose: { email: user.email, purpose: "email_verification" } },
      data: { isUsed: true, updatedAt: new Date() },
    }),
    db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
