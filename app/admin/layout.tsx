// /admin/** — server-side re-check of role on every render.
// The proxy already gates this, but Next 16 docs are explicit:
// always re-verify in the page/layout, never trust the edge alone.
//
// `/admin` is shared by:
//   - ADMIN  → full access (user management, catalog, everything)
//   - MANAGER → catalog only (cohorts, courses, modules)
// Per-subroute layouts/pages do a tighter role check.
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/forbidden");
  }
  return <>{children}</>;
}
