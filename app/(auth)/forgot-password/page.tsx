// /forgot-password — enter email to receive a password reset code.
import Link from "next/link";
import { Logo } from "@/components/public/Logo";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password · KnightLead" };

export default function ForgotPasswordPage() {
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
          <h1 className="mt-4 text-2xl font-bold text-ink">Forgot password</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Enter your email and we’ll send a reset code.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-hero"
          />
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-brand-500 hover:text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
