// Top-level 404 — applies to every route that doesn't resolve.
import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-muted px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">404</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The page you were looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-dim"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
