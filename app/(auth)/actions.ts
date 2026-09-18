"use server";

// Server Actions for auth flows. Validate with Zod, hash with bcrypt,
// rate-limit, and surface a structured result for React 19 useActionState.

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth, signIn } from "@/auth";
import { AuthError as NextAuthError } from "next-auth";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { createVerificationCode, verifyCode } from "@/lib/email-verification";

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string> } | null;

const registerSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  email: z.string().email("Enter a valid email").max(255).toLowerCase(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email").max(255).toLowerCase(),
  password: z.string().min(1, "Required").max(128),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState | void> {
  const ip = await clientIp();
  const limited = await rateLimit(`register:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return { error: "Too many attempts. Try again in a minute." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? "_";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { fieldErrors };
  }
  const { name, email, password } = parsed.data;

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "An account with that email already exists." };

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { name, email, role: "STUDENT", hashedPassword },
  });

  // Issue a verification code (OTP). If sending fails, surface it so the
  // user knows to check their spam folder or contact support.
  try {
    await createVerificationCode(user.id);
  } catch (e) {
    console.error("[mail] verification send failed:", e);
    return { error: "Account created, but we couldn't send the verification code. Please try again or contact support." };
  }

  // Sign the user in (but they'll hit the verification gate before
  // reaching protected pages).
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof NextAuthError) return { error: "Account created — please sign in." };
    throw e;
  }

  // Bounce to a "check your email" page; user can't proceed until verified.
  // We use a redirect (outside any error catch) to make this the final state.
  const { redirect } = await import("next/navigation");
  redirect("/verify-email");
}

const verifyOtpSchema = z.object({
  code: z.string().min(8).max(8).regex(/^[A-Z2-9]{8}$/, "Enter the code as shown in your email"),
});

export async function verifyOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState | void> {
  const ip = await clientIp();
  const limited = await rateLimit(`verify-otp:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return { error: "Too many attempts. Try again in a minute." };

  const parsed = verifyOtpSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Invalid verification code." };
  const { code } = parsed.data;

  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." };

  const result = await verifyCode(session.user.id, code);
  if (!result.ok) {
    switch (result.error) {
      case "expired": return { error: "This code has expired. Resend a new one." };
      case "already_used": return { error: "This code has already been used." };
      case "too_many_attempts": return { error: "Too many failed attempts. Resend a new code." };
      default: return { error: "Invalid verification code." };
    }
  }

  // Success — redirect to dashboard.
  const { redirect } = await import("next/navigation");
  redirect("/dashboard?verified=1");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState | void> {
  const ip = await clientIp();
  const limited = await rateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return { error: "Too many attempts. Try again in a minute." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? "_";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { fieldErrors };
  }
  const { email, password } = parsed.data;

  // Pre-check: if the user exists but email isn't verified, block login.
  const dbUser = await db.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });
  if (dbUser && !dbUser.emailVerified) {
    return { error: "Please verify your email first. We sent a code after registration." };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof NextAuthError) {
      return { error: "Invalid email or password." };
    }
    throw e;
  }
  const { redirect } = await import("next/navigation");
  redirect("/dashboard");
}
