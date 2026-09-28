"use server";

// Grade a submission. Instructor/admin only.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { recomputeProgress } from "@/lib/curriculum";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const input = z.object({
  submissionId: z.string().min(1).max(64),
  score: z.coerce.number().int().min(0).max(100),
  feedback: z.string().trim().max(5_000).optional().default(""),
});

export type GradeResult =
  | { ok: true; status: "GRADED" | "RETURNED" }
  | { ok: false; error: string };

export async function gradeSubmission(formData: FormData): Promise<GradeResult> {
  const grader = await requireRole("INSTRUCTOR", "ADMIN");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`grade:${grader.id}:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Slow down — too many grade actions." };

  const parsed = input.safeParse({
    submissionId: formData.get("submissionId"),
    score: formData.get("score"),
    feedback: formData.get("feedback") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { submissionId, score, feedback } = parsed.data;

  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      assignment: {
        select: {
          id: true,
          maxScore: true,
          module: {
            select: {
              id: true,
              courseId: true,
              course: { select: { slug: true, instructorId: true } },
            },
          },
        },
      },
    },
  });
  if (!sub) return { ok: false, error: "Submission not found" };

  // Instructors can only grade submissions for courses they own; admins can grade any.
  if (
    grader.role !== "ADMIN" &&
    sub.assignment.module.course.instructorId !== grader.id
  ) {
    return { ok: false, error: "You don't teach that course" };
  }

  // Cap at assignment's maxScore.
  const cappedScore = Math.min(score, sub.assignment.maxScore);

  await db.submission.update({
    where: { id: submissionId },
    data: {
      score: cappedScore,
      feedback,
      status: "GRADED",
      gradedAt: new Date(),
      gradedById: grader.id,
    },
  });

  // Grading a module's assignment means the student did that module's
  // work, so the module's lessons count as complete. Assessments are
  // module-level, so there is no single lesson to tick here — the whole
  // module is the unit that was evidenced.
  const moduleId = sub.assignment.module.id;
  const courseId = sub.assignment.module.courseId;
  const courseSlug = sub.assignment.module.course.slug;
  const userId = sub.userId;

  const moduleLessons = await db.lesson.findMany({
    where: { moduleId },
    select: { id: true },
  });
  if (moduleLessons.length > 0) {
    // Upsert rather than create-and-catch: a partially completed module
    // already has rows for some lessons.
    await db.lessonProgress.createMany({
      data: moduleLessons.map((l) => ({ userId, lessonId: l.id })),
      skipDuplicates: true,
    });
  }

  // Write progress back to the student's seat. A student can hold several
  // seats in one course (one per cohort), and each seat is scored against
  // its own cohort's curriculum, so update every live seat rather than
  // guessing which one this submission belongs to.
  const seats = await db.enrollment.findMany({
    where: { userId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { id: true, cohortId: true },
  });
  for (const seat of seats) {
    await recomputeProgress(userId, courseId, seat.cohortId);
  }

  // Audit log entry.
  await db.auditLog.create({
    data: {
      userId: grader.id,
      action: "GRADE_SUBMISSION",
      resource: `submission:${submissionId}`,
      metadata: { score: cappedScore },
    },
  });

  revalidatePath("/instructor/grading");
  revalidatePath(`/dashboard/courses/${courseSlug}`);
  // The module's lessons are now marked complete, so the course page and
  // each lesson page in the cohort plan need to re-render.
  for (const l of moduleLessons) {
    revalidatePath(`/dashboard/courses/${courseSlug}/lessons/${l.id}`);
  }
  revalidatePath("/dashboard");
  const assignmentId = sub.assignment.id;
  revalidatePath(`/instructor/grading?assignmentId=${assignmentId}`);
  return { ok: true, status: "GRADED" };
}

export async function returnSubmission(formData: FormData): Promise<GradeResult> {
  const grader = await requireRole("INSTRUCTOR", "ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return { ok: false, error: "Missing submission" };

  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      assignment: {
        select: {
          id: true,
          module: { select: { course: { select: { slug: true } } } },
        },
      },
    },
  });

  await db.submission.update({
    where: { id: submissionId },
    data: { status: "RETURNED", gradedById: grader.id, gradedAt: new Date() },
  });
  revalidatePath("/instructor/grading");
  revalidatePath(`/dashboard/courses/${sub?.assignment.module.course.slug ?? ""}`);
  const assignmentId = sub?.assignment.id;
  if (assignmentId) revalidatePath(`/instructor/grading?assignmentId=${assignmentId}`);
  return { ok: true, status: "RETURNED" };
}
