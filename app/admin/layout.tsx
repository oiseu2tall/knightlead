// Layout shared by every page under /admin. Renders the global
// `<AuthedShell>` with a role gate (MANAGER + ADMIN) and the
// consistent drawer / app bar. Per-page role checks remain as the
// authoritative authorization gate (Next 16 layouts don't re-render
// on every navigation).

import { AuthedShell } from "@/components/layout/AuthedShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthedShell allowedRoles={["MANAGER", "ADMIN"]}>{children}</AuthedShell>;
}
