// Server-rendered layout for the dashboard area. Authoritative auth check.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata = { title: "Dashboard · Bootcamp LMS" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.emailVerified) redirect("/verify-email/pending");
  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
