// AuthedShell — a single shared layout wrapper for every section a
// logged-in user can see. It handles:
//   1. Authentication: redirect to /login if no session.
//   2. Email verification: redirect to /verify-email/pending if the
//      user's email isn't verified yet.
//   3. Role gating (optional): if `allowedRoles` is provided, redirect
//      to /forbidden when the user isn't on the list.
//   4. Rendering the global `<DashboardShell>` (drawer + app bar)
//      that every authed area uses for its sidebar navigation.
//
// Page-level role checks are STILL required (Next 16 layouts don't
// re-render on every navigation, so per-page checks are the
// authoritative authorization check). This shell is the *visual*
// shell plus a fast first-pass gate.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "./DashboardShell";
import type { Role } from "@/lib/role";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** When set, the user must have one of these roles. Others are
   *  bounced to /forbidden. Omit to allow any verified user. */
  allowedRoles?: Role[];
  /** Default true. Set to false to skip the email-verification gate
   *  (e.g. for a future "resend verification" page that needs to
   *  render even before the user is verified). */
  requireVerifiedEmail?: boolean;
};

export async function AuthedShell({
  children,
  allowedRoles,
  requireVerifiedEmail = true,
}: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (requireVerifiedEmail && !session.user.emailVerified) {
    redirect("/verify-email/pending");
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role as Role)) {
    redirect("/forbidden");
  }
  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
