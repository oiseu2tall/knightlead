// Shown immediately after registration. Tells the user to check their inbox.
import { Card, PageHeader } from "@/components/ui/Primitives";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ResendButton } from "./ResendButton";

export const metadata = { title: "Check your inbox" };

export default async function VerifyEmailPending() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Already verified? Skip.
  const u = session.user as { emailVerified?: Date | null };
  if (u.emailVerified) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <Card className="max-w-md text-center">
        <PageHeader
          title="Check your inbox"
          description={`We sent a verification link to ${session.user.email}. Click it to finish setting up your account.`}
        />
        <p className="text-sm text-ink-muted">
          Didn't get the email? You can resend it.
        </p>
        <div className="mt-4 flex justify-center">
          <ResendButton />
        </div>
      </Card>
    </main>
  );
}
