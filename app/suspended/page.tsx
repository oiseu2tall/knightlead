// /suspended — shown to any logged-in user whose account has been
// suspended by an admin. The proxy rewrites here on every request, so
// this page must render without a session (it's in the public list in
// auth.ts). The user can still sign out.
import Link from "next/link";
import { Card } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <Icon.Ban className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Account suspended</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your account has been suspended by an administrator. You can&#39;t access the LMS
          while suspended. Contact your admin to request reactivation.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Sign in with a different account
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
}