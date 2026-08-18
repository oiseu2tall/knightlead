"use server";

// Grade a submission. Instructor/admin only.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
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
          lessonId: true,
          maxScore: true,
          lesson: {
            select: {
              id: true,
              module: { select: { courseId: true, course: { select: { slug: true, instructorId: true } } } },
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
    sub.assignment.lesson.module.course.instructorId !== grader.id
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

  // Auto-complete the lesson when the assignment is graded.
  const lessonId = sub.assignment.lessonId;
  const courseId = sub.assignment.lesson.module.courseId;
  const courseSlug = sub.assignment.lesson.module.course.slug;
  const userId = sub.userId;

  try {
    await db.lessonProgress.create({ data: { userId, lessonId } });
  } catch (e: unknown) {
    if (!(e as { code?: string }).code || (e as { code?: string }).code !== "P2002") throw e;
  }

  const lessonIds = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const lessonIdList = lessonIds.map((l) => l.id);

  const [completed, total] = await Promise.all([
    lessonIdList.length
      ? db.lessonProgress.count({
          where: { userId, lessonId: { in: lessonIdList } },
        })
      : 0,
    lessonIdList.length,
  ]);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (enrollment) {
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progress: percent,
        status: percent === 100 ? "COMPLETED" : "ACTIVE",
        completedAt: percent === 100 ? new Date() : null,
      },
    });
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
  revalidatePath(`/dashboard/courses/${courseSlug}/lessons/${lessonId}`);
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
          lesson: { select: { module: { select: { course: { select: { slug: true } } } } } },
        },
      },
    },
  });

  await db.submission.update({
    where: { id: submissionId },
    data: { status: "RETURNED", gradedById: grader.id, gradedAt: new Date() },
  });
  revalidatePath("/instructor/grading");
  revalidatePath(`/dashboard/courses/${sub?.assignment.lesson.module.course.slug ?? ""}`);
  const assignmentId = sub?.assignment.id;
  if (assignmentId) revalidatePath(`/instructor/grading?assignmentId=${assignmentId}`);
  return { ok: true, status: "RETURNED" };
}
