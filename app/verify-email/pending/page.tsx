// /verify-email/pending — tells the user to check their inbox for the code.
// Also includes an inline OTP form so the user can submit the code
// directly without navigating back to /verify-email.
"use client";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { ResendButton } from "./ResendButton";
import { VerifyOtpForm } from "../VerifyOtpForm";
import { signOutAction } from "@/app/(auth)/signout-action";
import { useTransition } from "react";

export const metadata = { title: "Check your inbox · KnightLead" };

export default async function VerifyEmailPending() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.emailVerified) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <Card className="max-w-md text-center">
        <PageHeader
          title="Check your email"
          description={`We sent a verification code to ${session.user.email}. Enter it below to verify.`}
        />
        <VerifyOtpForm email={session.user.email ?? ""} />
        <p className="mt-4 text-sm text-ink-muted">
          Didnt receive it? You can request a new code.
        </p>
        <div className="mt-2 flex justify-center">
          <ResendButton />
        </div>
        <SignOutButton />
        <p className="mt-4 text-xs text-ink-muted">
          Make sure to check your spam or junk folder.
        </p>
      </Card>
    </main>
  );
}

function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
      className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-disabled"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      )}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}