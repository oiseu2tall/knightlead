// Shown when the proxy or page-level guard denies access to a route.
import Link from "next/link";

export const metadata = { title: "Forbidden" };

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">403</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">You don't have access</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your account doesn't have permission to view that page.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
