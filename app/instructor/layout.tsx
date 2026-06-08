// Layout shared by every page under /instructor. Renders the
// global `<AuthedShell>` with a role gate (INSTRUCTOR + ADMIN) and
// the consistent drawer / app bar.

import { AuthedShell } from "@/components/layout/AuthedShell";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return <AuthedShell allowedRoles={["INSTRUCTOR", "ADMIN"]}>{children}</AuthedShell>;
}
