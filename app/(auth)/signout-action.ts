"use server";

// Server action wrapper around Auth.js v5's signOut(). Lives in the
// (auth) route group so the export name doesn't conflict with the
// `signOut` import in the dashboard shell.
import { signOut } from "@/auth";

export async function signOutAction() {
  // Auth.js clears the session cookie, then throws a redirect that
  // the framework unwinds. We point it at /login so the user lands
  // on the sign-in screen rather than the marketing page.
  await signOut({ redirectTo: "/login" });
}
