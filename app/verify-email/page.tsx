// /verify-email?token=...&uid=... — consumes the link, redirects.
import { redirect } from "next/navigation";
import { consumeVerificationToken } from "@/lib/email-verification";
import { Card, PageHeader } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; uid?: string }>;
}) {
  const { token, uid } = await searchParams; // Next 16: Promise
  if (!token || !uid) redirect("/login");

  const result = await consumeVerificationToken(uid, token);
  if (result.ok) {
    redirect("/dashboard?verified=1");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4">
      <Card className="max-w-md text-center">
        <PageHeader
          title="Verification link expired"
          description={result.error === "expired"
            ? "That link is no longer valid. Request a new one below."
            : "We couldn't verify that link. It may have already been used."}
        />
        <Link
          href="/verify-email/resend"
          className="inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Resend verification email
        </Link>
      </Card>
    </main>
  );
}
