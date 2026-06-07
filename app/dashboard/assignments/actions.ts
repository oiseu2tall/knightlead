"use server";

// Assignment submission. Validates, stores content + file keys,
// enforces 1-attempt-resubmit policy.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const input = z.object({
  assignmentId: z.string().min(1).max(64),
  content: z.string().trim().min(1, "Add a description").max(20_000),
  attachments: z.array(z.string().min(1).max(200)).max(5).default([]),
});

export type SubmitResult =
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

export async function submitAssignment(formData: FormData): Promise<SubmitResult> {
  const user = await requireUser();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit(`submit:${user.id}:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: "Too many submissions. Slow down." };

  let attachments: string[] = [];
  try {
    const raw = formData.get("attachments");
    if (typeof raw === "string" && raw) attachments = JSON.parse(raw) as string[];
  } catch {
    return { ok: false, error: "Invalid attachment payload" };
  }

  const parsed = input.safeParse({
    assignmentId: formData.get("assignmentId"),
    content: formData.get("content"),
    attachments,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { assignmentId, content, attachments: files } = parsed.data;

  // Verify assignment exists + user is enrolled in the parent course.
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      lesson: {
        select: {
          module: {
            select: {
              courseId: true,
              course: { select: { slug: true } },
            },
          },
        },
      },
    },
  });
  if (!assignment) return { ok: false, error: "Assignment not found" };

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: assignment.lesson.module.courseId } },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, error: "You are not enrolled in this course" };

  // Idempotent create: if a submission already exists, update it (resubmit).
  const existing = await db.submission.findFirst({
    where: { assignmentId, userId: user.id },
    select: { id: true },
  });

  const data = {
    content,
    attachments: files,
    status: "SUBMITTED" as const,
    submittedAt: new Date(),
    score: null,
    feedback: null,
    gradedAt: null,
    gradedById: null,
  };

  const submission = existing
    ? await db.submission.update({ where: { id: existing.id }, data })
    : await db.submission.create({ data: { ...data, assignmentId, userId: user.id } });

  revalidatePath(`/instructor/grading`);
  revalidatePath(`/dashboard/courses/${assignment.lesson.module.course.slug}`);
  return { ok: true, submissionId: submission.id };
}
