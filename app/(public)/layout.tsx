// Layout for the public marketing site. These routes are readable by
// anyone, including guests — nothing here calls `auth()` to gate access.
// It reads the session only to decide whether the header's account button
// should offer "Sign in" or "Dashboard".
import { auth } from "@/auth";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      <PublicHeader accountHref={session?.user ? "/dashboard" : "/login"} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}