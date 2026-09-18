// /verify-email — OTP input form. Users enter the code they received
// via email. Server Action verifies it atomically.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { VerifyOtpForm } from "./VerifyOtpForm";

export const metadata = { title: "Verify email · KnightLead" };

export default async function VerifyEmailPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.emailVerified) redirect("/dashboard");

  const email = session.user.email ?? "";

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <Card className="max-w-md w-full text-center">
        <PageHeader
          title="Check your email"
          description="Enter the verification code we sent to confirm your email address."
        />
        <VerifyOtpForm email={email} />
        <p className="mt-4 text-sm text-ink-muted">
          Didn't get the code?{" "}
          <a href="/verify-email/pending" className="font-semibold text-brand-500 hover:text-brand-600">
            Resend
          </a>
        </p>
      </Card>
    </main>
  );
}
