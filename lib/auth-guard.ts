// Server-side auth helpers. Use these inside Server Actions, Route
// Handlers, and RSCs. The proxy alone is NOT sufficient — Next 16 docs
// explicitly warn: "always verify authentication and authorization
// inside each Server Function rather than relying on Proxy alone."

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

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
 * Only STUDENTs can self-enroll. ADMIN has full access to student
 * features for review/testing, but cannot enroll themselves here.
 * Staff-enrollment for others is handled by `canEnrollOthers()`.
 */
export function canEnroll(role: Role | undefined | null): boolean {
  return role === "STUDENT";
}

/**
 * Staff who can enroll STUDENTs on their behalf. MANAGER and ADMIN.
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
 * Suspend or activate user accounts. ADMIN only.
 */
export function canSuspendUsers(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

/**
 * Approve / activate pending self-enrollments. MANAGER and ADMIN.
 * Staff-enrolled students are created ACTIVE by default, so this
 * capability only matters for the PENDING self-enroll flow.
 */
export function canApproveEnrollments(role: Role | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

/**
 * Grading submissions. INSTRUCTOR (their own courses) and ADMIN.
 */
export function canGrade(role: Role | undefined | null): boolean {
  return role === "INSTRUCTOR" || role === "ADMIN";
}

/**
 * Viewing course content and lessons without holding a seat.
 *
 * ADMIN only, and strictly read-only: a preview shows what a student would
 * see, with no progress, no release gates, and no submission forms. It
 * exists because an admin holding no enrollment would otherwise hit
 * "You're not enrolled yet" on every course they are responsible for, with
 * no way to inspect the curriculum they just published.
 *
 * Deliberately not extended to MANAGER or INSTRUCTOR — those roles reach
 * course material through the catalog and teaching views instead, which
 * don't pretend to be a student's seat.
 */
export function canPreviewCourseContent(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

// ---------------------------------------------------------------------------
// Cohort-aware course access
// ---------------------------------------------------------------------------

/** Enrollment states that grant access to a course's content. */
const LIVE_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"] as const;

/**
 * The student's seat in a course, if any.
 *
 * Access to a course is derived from an approved cohort seat, never from
 * a course-level row: a student enrolls into an *intake*, and the cohort
 * determines the course. Because one course can have many cohorts, a
 * student may hold several seats in the same course — so this resolves to
 * the single most relevant seat rather than expecting one.
 *
 * `access` distinguishes the three states the UI must render differently:
 *   - "live"    → an approved seat; course content is unlocked
 *   - "pending" → a self-enrollment awaiting manager approval
 *   - "none"    → no seat in any cohort of this course
 */
export type CourseAccess = {
  access: "live" | "pending" | "none";
  enrollmentId: string | null;
  cohortId: string | null;
  cohortName: string | null;
  status: (typeof LIVE_ENROLLMENT_STATUSES)[number] | "PENDING" | "DROPPED" | "SUSPENDED" | null;
  progress: number;
  /** Every seat the student holds in this course, one per cohort. */
  seats: {
    enrollmentId: string;
    cohortId: string;
    cohortName: string;
    cohortSlug: string;
    status: string;
    progress: number;
    approvedAt: Date | null;
  }[];
};

/**
 * Resolve how a student may access a course, based on their cohort seats.
 *
 * This is the single source of truth for course access — course pages,
 * lesson pages, assignment actions, and grading all call it, so the
 * PENDING/live rules can't drift between them.
 */
export async function getCourseAccess(userId: string, courseId: string): Promise<CourseAccess> {
  const rows = await db.enrollment.findMany({
    where: { userId, courseId },
    include: { cohort: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ enrolledAt: "desc" }],
  });

  const seats = rows.map((e) => ({
    enrollmentId: e.id,
    cohortId: e.cohortId,
    cohortName: e.cohort.name,
    cohortSlug: e.cohort.slug,
    status: e.status,
    progress: e.progress,
    approvedAt: e.approvedAt,
  }));

  // A live seat wins over a pending one: a student approved into one
  // intake can already work, so a second pending request shouldn't hide
  // their access. Prefer the most recently approved live seat.
  const live = seats.find(
    (s) => s.status === "COMPLETED" || s.status === "ACTIVE",
  );
  if (live) {
    return {
      access: "live",
      enrollmentId: live.enrollmentId,
      cohortId: live.cohortId,
      cohortName: live.cohortName,
      status: live.status as CourseAccess["status"],
      progress: live.progress,
      seats,
    };
  }

  const pending = seats.find((s) => s.status === "PENDING");
  if (pending) {
    return {
      access: "pending",
      enrollmentId: pending.enrollmentId,
      cohortId: pending.cohortId,
      cohortName: pending.cohortName,
      status: "PENDING",
      progress: pending.progress,
      seats,
    };
  }

  return {
    access: "none",
    enrollmentId: null,
    cohortId: null,
    cohortName: null,
    status: null,
    progress: 0,
    seats,
  };
}

/**
 * The seat to write progress to: the student's live one in this course.
 *
 * Returns null when the student has no live seat. Callers should treat
 * null as "not enrolled" and refuse the write.
 */
export async function findLiveEnrollment(userId: string, courseId: string) {
  return db.enrollment.findFirst({
    where: { userId, courseId, status: { in: [...LIVE_ENROLLMENT_STATUSES] } },
    orderBy: [{ approvedAt: "desc" }, { enrolledAt: "desc" }],
    select: { id: true, cohortId: true, progress: true, status: true },
  });
}

/**
 * Whether a cohort can still accept seats, ignoring any existing seat the
 * user may already hold.
 *
 * `isOpen` gates self-enrollment only — staff placing a student
 * overrides it. `capacity` gates both. Returns a reason when the cohort
 * is not available, so callers can surface it directly.
 */
export async function cohortAvailability(cohort: {
  isOpen: boolean;
  capacity: number | null;
  enrolledCount: number;
}): Promise<{ open: boolean; reason: string | null }> {
  if (cohort.capacity !== null && cohort.enrolledCount >= cohort.capacity) {
    return { open: false, reason: "This cohort is full." };
  }
  if (!cohort.isOpen) {
    return { open: false, reason: "This cohort is not open for enrollment." };
  }
  return { open: true, reason: null };
}
