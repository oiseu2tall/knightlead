// /reset-password — enter reset code + new password to reset your password.
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/public/Logo";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password · KnightLead" };

export default async function ResetPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-ink"
          >
            <Logo height={32} />
            KnightLead LMS
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">Reset password</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Enter the reset code sent to your email and choose a new password.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-hero"
          />
          <ResetPasswordForm />
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Don’t have a code?{" "}
          <Link href="/forgot-password" className="font-semibold text-brand-500 hover:text-brand-600">
            Request one
          </Link>
        </p>
      </div>
    </main>
  );
}
