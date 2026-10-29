// /verify-email/pending — tells the user to check their inbox for the code.
// Also includes an inline OTP form so the user can submit the code
// directly without navigating back to /verify-email.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ResendButton } from "./ResendButton";
import { VerifyOtpForm } from "../VerifyOtpForm";
import { SignOutButton } from "./SignOutButton";

export const metadata = { title: "Check your inbox · KnightLead" };

export default async function VerifyEmailPending() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.emailVerified) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <div className="max-w-md text-center mx-auto">
        <h1 className="mb-3 text-2xl font-bold text-ink">Check your email</h1>
        <p className="mb-6 text-sm text-ink-muted">
          We sent a verification code to {session.user.email}. Enter it below to verify.
        </p>
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
      </div>
    </main>
  );
}
