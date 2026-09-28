"use server";

// Lesson-completion + enrollment server actions.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, AuthError, canEnroll } from "@/lib/auth-guard";
import { findSeatTeachingLesson, recomputeProgress } from "@/lib/curriculum";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const input = z.object({
  lessonId: z.string().min(1).max(64),
  courseSlug: z.string().min(1).max(120),
});

export type LessonActionResult =
  | { ok: true; progress: number }
  | { ok: false; error: string };

export type EnrollResult = { ok: true } | { ok: false; error: string };

export async function markLessonComplete(formData: FormData): Promise<LessonActionResult> {
  const user = await requireUser();
  const parsed = input.safeParse({
    lessonId: formData.get("lessonId"),
    courseSlug: formData.get("courseSlug"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { lessonId, courseSlug } = parsed.data;

  // 1. Resolve lesson + course.
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true, course: { select: { slug: true } } } } },
  });
  if (!lesson || lesson.module.course.slug !== courseSlug) {
    return { ok: false, error: "Lesson not found" };
  }
  const courseId = lesson.module.courseId;

  // 2. Find the live seat whose cohort actually teaches this lesson. A
  // student can hold several seats in one course (one per intake), and a
  // cohort's plan may not include every course lesson — crediting the
  // wrong seat, or a lesson this intake never scheduled, would both
  // corrupt that seat's progress.
  const seat = await findSeatTeachingLesson(user.id, courseId, lessonId);
  if (!seat) return { ok: false, error: "This lesson isn't part of your cohort's plan" };

  // 3. Upsert the progress row. `create` may fail on duplicate — caught.
  try {
    await db.lessonProgress.create({ data: { userId: user.id, lessonId } });
  } catch (e: unknown) {
    // Unique constraint — already complete. Treat as success.
    if (!(e as { code?: string }).code || (e as { code?: string }).code !== "P2002") throw e;
  }

  // 4. Recompute progress against that seat's curriculum, so a student is
  // measured against the plan their intake actually teaches.
  const percent =
    (await recomputeProgress(user.id, courseId, seat.cohortId)) ?? 0;

  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  return { ok: true, progress: percent };
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

const enrollInput = z.object({
  cohortId: z.string().min(1).max(64),
});

/**
 * Enroll the current user in a cohort.
 *
 * Students enroll into an *intake*, not into a course. The course is
 * derived from the cohort, so a student who takes the same course twice
 * holds two seats in two cohorts rather than colliding on a single
 * course-level row. `isOpen` gates self-enrollment; staff-created seats
 * bypass it (see staffEnrollStudent).
 *
 * Role rule: only STUDENTs can enroll. INSTRUCTOR, MANAGER, and ADMIN
 * are staff — they supervise the catalog, they don't take courses. This
 * is a product decision, NOT a hierarchy: ADMIN does NOT inherit the
 * right to enroll. See `canEnroll()` in lib/auth-guard.ts.
 */
export async function enrollInCohort(formData: FormData): Promise<EnrollResult> {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "You must be signed in." };
    throw e;
  }

  if (!canEnroll(user.role)) {
    return { ok: false, error: "Only students can enroll. Staff accounts supervise the catalog." };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`enroll:${user.id}:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Slow down — too many enrollment requests." };

  const parsed = enrollInput.safeParse({ cohortId: formData.get("cohortId") });
  if (!parsed.success) return { ok: false, error: "Invalid cohort" };
  const { cohortId } = parsed.data;

  // The cohort carries the course. Self-enrollment additionally requires
  // the course to be published and the intake to be open.
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      isOpen: true,
      capacity: true,
      course: { select: { id: true, slug: true, isPublished: true } },
    },
  });
  if (!cohort) return { ok: false, error: "Cohort not found" };
  if (!cohort.course.isPublished) {
    return { ok: false, error: "This course is not available for enrollment yet." };
  }
  if (!cohort.isOpen) {
    return { ok: false, error: `"${cohort.name}" is not open for enrollment. Contact your coordinator.` };
  }

  // Idempotent: an existing seat in this cohort is a no-op success. Note
  // this is per-cohort, so a prior seat in a *different* cohort of the
  // same course does not block a new request.
  const existing = await db.enrollment.findUnique({
    where: { userId_cohortId: { userId: user.id, cohortId } },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/courses/browse");
    return { ok: true };
  }

  if (cohort.capacity !== null) {
    const taken = await db.enrollment.count({
      where: { cohortId, status: { in: ["PENDING", "ACTIVE", "COMPLETED"] } },
    });
    if (taken >= cohort.capacity) {
      return { ok: false, error: `"${cohort.name}" is full. Pick another intake.` };
    }
  }

  // Self-enrollments start in PENDING state: the student can't access
  // course content until a manager or admin approves/activates the
  // enrollment. This is a deliberate product decision — see the
  // capability matrix in README.md.
  await db.enrollment.create({
    data: {
      userId: user.id,
      cohortId,
      // Denormalized copy of cohort.courseId.
      courseId: cohort.course.id,
      status: "PENDING",
      progress: 0,
    },
  });
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ENROLL_COHORT",
      resource: `cohort:${cohortId}`,
      metadata: { course: cohort.course.slug },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/courses/browse");
  revalidatePath(`/dashboard/courses/${cohort.course.slug}`);
  return { ok: true };
}

/**
 * Cancel the current user's own PENDING request for a cohort.
 *
 * Only PENDING rows are withdrawable: an ACTIVE seat represents course
 * work already done, and that relationship should be ended by a manager
 * (or by completing the course), not silently by the student.
 */
export async function withdrawEnrollment(formData: FormData): Promise<EnrollResult> {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "You must be signed in." };
    throw e;
  }

  if (!canEnroll(user.role)) {
    return { ok: false, error: "Only students can manage enrollments." };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`enroll-withdraw:${user.id}:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Slow down — too many requests." };

  const parsed = enrollInput.safeParse({ cohortId: formData.get("cohortId") });
  if (!parsed.success) return { ok: false, error: "Invalid cohort" };
  const { cohortId } = parsed.data;

  // Scoped by userId as well as id-derived lookup, so one student can
  // never cancel another's request by guessing a cohort id.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_cohortId: { userId: user.id, cohortId } },
    select: { id: true, status: true, cohort: { select: { course: { select: { slug: true } } } } },
  });
  if (!enrollment) return { ok: false, error: "You are not enrolled in this cohort." };
  if (enrollment.status !== "PENDING") {
    return { ok: false, error: "This seat is already active — contact your coordinator to leave." };
  }

  await db.enrollment.update({ where: { id: enrollment.id }, data: { status: "DROPPED" } });
  await db.auditLog.create({
    data: { userId: user.id, action: "WITHDRAW_ENROLLMENT", resource: `enrollment:${enrollment.id}` },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/courses/browse");
  revalidatePath(`/dashboard/courses/${enrollment.cohort.course.slug}`);
  return { ok: true };
}
