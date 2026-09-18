"use server";

import { requireUser } from "@/lib/auth-guard";
import { createVerificationCode } from "@/lib/email-verification";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type ResendResult = { ok: true } | { ok: false; error: string };

export async function resendVerification(_fd: FormData): Promise<ResendResult> {
  const user = await requireUser();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`verify-resend:${user.id}:${ip}`, { limit: 3, windowMs: 60_000 * 10 });
  if (!limited.ok) return { ok: false, error: "You can only resend a few times per hour. Try again later." };

  try {
    await createVerificationCode(user.id);
    return { ok: true };
  } catch (e) {
    console.error("[mail] resend verification failed:", e);
    return { ok: false, error: "Couldn't send verification code. Please try again." };
  }
}
