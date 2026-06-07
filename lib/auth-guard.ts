// Server-side auth helpers. Use these inside Server Actions, Route
// Handlers, and RSCs. The proxy alone is NOT sufficient — Next 16 docs
// explicitly warn: "always verify authentication and authorization
// inside each Server Function rather than relying on Proxy alone."

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export class AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    // In a Server Action: throw; in a page: redirect.
    throw new AuthError("UNAUTHENTICATED");
  }
  return session.user;
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new AuthError("FORBIDDEN");
  }
  return user;
}

/**
 * Page-level variant — redirects to /login or /forbidden instead of throwing.
 * Use in server components and pages, NOT in Server Actions.
 */
export async function requireRoleOrRedirect(...allowed: Role[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!allowed.includes(session.user.role)) redirect("/forbidden");
  return session.user;
}

/**
 * Wraps a Server Action so unauthorized callers get a typed error result
 * instead of an uncaught exception. Combine with `useActionState` on the client.
 */
export function withAuth<TArgs extends unknown[], TResult>(
  fn: (user: { id: string; role: Role }, ...args: TArgs) => Promise<TResult>,
  allowed: Role[] = [],
) {
  return async (...args: TArgs): Promise<TResult | { error: string }> => {
    try {
      const user = await requireRole(...allowed);
      return await fn(user, ...args);
    } catch (e) {
      if (e instanceof AuthError) {
        return { error: e.code === "UNAUTHENTICATED"
          ? "You must be signed in."
          : "You don't have permission to do that." };
      }
      throw e;
    }
  };
}

// ---------------------------------------------------------------------------
// Role capability helpers — single source of truth for "who can do what".
// Pages and Server Actions must consult these (or the explicit requireRole
// call) instead of inlining role checks. Keeps the rules auditable.
// ---------------------------------------------------------------------------

/**
 * Only STUDENTs can enroll. Instructors, Managers, and Admins are
 * staff — they supervise the catalog, they don't take courses.
 * This is a product decision, not a hierarchy: ADMIN does NOT inherit
 * the right to enroll.
 */
export function canEnroll(role: Role | undefined | null): boolean {
  return role === "STUDENT";
}

/**
 * Staff can enroll STUDENTs on their behalf. MANAGER and ADMIN use
 * this to assign students to cohorts and courses from the catalog
 * admin panel. INSTRUCTORs cannot — they only grade; the catalog
 * belongs to MANAGER + ADMIN.
 */
export function canEnrollOthers(role: Role | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

/**
 * Catalog managers — cohorts, courses, modules. ADMIN and MANAGER.
 */
export function canManageCatalog(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * User-management (search, role changes). ADMIN only.
 */
export function canManageUsers(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

/**
 * Grading submissions. INSTRUCTOR (their own courses) and ADMIN.
 */
export function canGrade(role: Role | undefined | null): boolean {
  return role === "INSTRUCTOR" || role === "ADMIN";
}
