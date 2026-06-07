// /login — client form bound to the loginAction via React 19 useActionState.
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Bootcamp LMS" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-ink"
          >
            <span className="h-6 w-6 rounded-md bg-hero" aria-hidden="true" />
            Bootcamp LMS
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to continue learning.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-hero"
          />
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-brand-500 hover:text-brand-600">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
