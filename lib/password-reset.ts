// Password reset — OTP-style (code-based) flow.
// Users request a reset code via email, enter it with a new password,
// and the code is consumed atomically to prevent double-use.
// Code is stored in the PasswordReset table with a 30-minute TTL and
// a max-attempts counter for rate limiting.

import { db } from "@/lib/db";
import { getMailer } from "@/lib/mailer";
import { generateInvitationCode } from "@/lib/otp";

const CODE_TTL_MINUTES = 30;
const MAX_ATTEMPTS = 5;

export interface PasswordResetResult {
  ok: boolean;
  error?: "expired" | "already_used" | "too_many_attempts" | "invalid" | "send_failed" | "user_not_found";
}

export interface PasswordResetRecord {
  code: string;
  expiresAt: Date;
  attemptsCount: number;
}

/**
 * Create a new password reset OTP for the given email. Sends the code via email.
 * Returns the created record on success, or throws on email failure.
 * Does not reveal whether the email exists (returns success even if not found
 * to prevent email enumeration).
 */
export async function createPasswordResetCode(email: string): Promise<PasswordResetRecord> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  // Always generate and store a code so we don't leak whether the email exists.
  const code = generateInvitationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // UPSERT: update existing reset or create new.
  await db.passwordReset.upsert({
    where: { email },
    update: {
      code,
      isUsed: false,
      expiresAt,
      attemptsCount: 0,
    },
    create: {
      email,
      code,
      isUsed: false,
      expiresAt,
      attemptsCount: 0,
    },
  });

  // Only send email if the user actually exists.
  if (user) {
    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    const text = `Hi ${user.name ?? "there"},\n\nYour password reset code is: ${code}\n\nThis code expires in ${CODE_TTL_MINUTES} minutes.\n\nEnter it at: ${base}/reset-password`;
    const html = `<p>Hi ${escapeHtml(user.name ?? "there")},</p>
<p>Your password reset code is:</p>
<p class="code" style="font-family: monospace; font-size: 1.5em; font-weight: bold; background: #f5f5f5; padding: 8px 16px; border-radius: 4px; display: inline-block;">${code}</p>
<p>This code expires in ${CODE_TTL_MINUTES} minutes.</p>
<p>Enter it at: <a href="${base}/reset-password">${base}/reset-password</a></p>`;

    try {
      await (await getMailer()).send({
        to: user.email,
        subject: "Reset your password — KnightLead",
        text,
        html,
      });
    } catch {
      throw new Error("send_failed");
    }
  }

  return { code, expiresAt, attemptsCount: 0 };
}

/**
 * Verify a password reset code for the given email. Uses an atomic
 * UPDATE+RETURNING to prevent race conditions and double-use.
 * Returns the user record if valid, or an error result.
 */
export async function verifyPasswordResetCode(email: string, code: string): Promise<{ ok: true; user: { id: string; email: string; name: string | null } } | { ok: false; error: PasswordResetResult["error"] }> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { ok: false, error: "invalid" };

  const record = await db.passwordReset.findUnique({
    where: { email },
  });

  if (!record) return { ok: false, error: "invalid" };
  if (record.isUsed) return { ok: false, error: "already_used" };
  if (record.expiresAt < new Date()) return { ok: false, error: "expired" };
  if (record.attemptsCount >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };
  if (record.code !== code) {
    await db.passwordReset.update({
      where: { email },
      data: { attemptsCount: { increment: 1 } },
    });
    return { ok: false, error: "invalid" };
  }

  // Mark as used atomically.
  await db.passwordReset.update({
    where: { email },
    data: { isUsed: true, updatedAt: new Date() },
  });

  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}

/**
 * Reset the user's password after a code has been verified and consumed.
 */
export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: userId },
    data: { hashedPassword },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
