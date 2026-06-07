"use server";

// Lesson-completion + enrollment server actions.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, AuthError, canEnroll } from "@/lib/auth-guard";
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

  // 2. User must be enrolled.
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, error: "You are not enrolled in this course" };

  // 3. Upsert the progress row. `create` may fail on duplicate — caught.
  try {
    await db.lessonProgress.create({ data: { userId: user.id, lessonId } });
  } catch (e: unknown) {
    // Unique constraint — already complete. Treat as success.
    if (!(e as { code?: string }).code || (e as { code?: string }).code !== "P2002") throw e;
  }

  // 4. Recompute course progress: completed / total lessons.
  // `LessonProgress` doesn't expose a `lesson` relation — only the
  // `lessonId` FK — so we collect the lesson ids for this course
  // first and count the progress rows whose `lessonId` is in the set.
  const lessonIds = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const lessonIdList = lessonIds.map((l) => l.id);

  const [completed, total] = await Promise.all([
    lessonIdList.length
      ? db.lessonProgress.count({
          where: { userId: user.id, lessonId: { in: lessonIdList } },
        })
      : 0,
    lessonIdList.length,
  ]);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: percent,
      status: percent === 100 ? "COMPLETED" : "ACTIVE",
      completedAt: percent === 100 ? new Date() : null,
    },
  });

  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath("/dashboard");
  return { ok: true, progress: percent };
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

const enrollInput = z.object({
  courseId: z.string().min(1).max(64),
});

/**
 * Enroll the current user in a course.
 *
 * Role rule: only STUDENTs can enroll. INSTRUCTOR, MANAGER, and ADMIN
 * are staff — they supervise the catalog, they don't take courses. This
 * is a product decision, NOT a hierarchy: ADMIN does NOT inherit the
 * right to enroll. See `canEnroll()` in lib/auth-guard.ts.
 */
export async function enrollInCourse(formData: FormData): Promise<EnrollResult> {
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

  const parsed = enrollInput.safeParse({ courseId: formData.get("courseId") });
  if (!parsed.success) return { ok: false, error: "Invalid course" };
  const { courseId } = parsed.data;

  // Course must exist and be published.
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, isPublished: true },
  });
  if (!course) return { ok: false, error: "Course not found" };
  if (!course.isPublished) return { ok: false, error: "This course is not available for enrollment yet." };

  // Idempotent: existing enrollment is a no-op success.
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/courses/browse");
    return { ok: true };
  }

  await db.enrollment.create({
    data: { userId: user.id, courseId, status: "ACTIVE", progress: 0 },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "ENROLL_COURSE", resource: `course:${courseId}` },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/courses/browse");
  revalidatePath(`/dashboard/courses/${course.slug}`);
  return { ok: true };
}
