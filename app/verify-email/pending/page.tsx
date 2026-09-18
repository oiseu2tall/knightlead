// /verify-email/pending — tells the user to check their inbox for the code.
// Also includes an inline OTP form so the user can submit the code
// directly without navigating back to /verify-email.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { ResendButton } from "./ResendButton";
import { VerifyOtpForm } from "../VerifyOtpForm";

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
        <p className="mt-4 text-xs text-ink-muted">
          Make sure to check your spam or junk folder.
        </p>
      </Card>
    </main>
  );
}