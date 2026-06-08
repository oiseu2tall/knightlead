// Layout shared by every page under /dashboard. Uses the global
// `<AuthedShell>` so the drawer + app bar appear on all student-
// facing pages.
import { AuthedShell } from "@/components/layout/AuthedShell";

export const metadata = { title: "Dashboard · Bootcamp LMS" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthedShell>{children}</AuthedShell>;
}
