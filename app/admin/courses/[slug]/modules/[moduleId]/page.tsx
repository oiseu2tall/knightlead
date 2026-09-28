// /admin/courses/[slug]/modules/[moduleId] — module detail with
// lesson and assessment management for MANAGER + ADMIN.
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { signToken } from "@/lib/storage";
import ModuleAssignmentsClient from "./ModuleAssignmentsClient";

export const metadata = { title: "Module · Catalog" };

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!course) notFound();

  const mod = await db.module.findUnique({
    where: { id: moduleId },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, contentType: true, content: true, durationMin: true, order: true, isFree: true },
      },
      // Assessments hang off the module directly, not off a lesson.
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { submissions: true } } },
      },
      quizzes: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      },
    },
  });
  if (!mod || mod.courseId !== course.id) notFound();

  // Uploaded lesson videos carry a stored object, so the admin view needs a
  // signed download URL to preview or replace them.
  const videos = await db.lessonVideo.findMany({
    where: { lesson: { moduleId: mod.id } },
    orderBy: [{ lessonId: "asc" }, { order: "asc" }],
    include: { lesson: { select: { id: true, title: true } } },
  });

  const assignments = mod.assignments.map((a) => ({
    id: a.id,
    title: a.title,
    prompt: a.prompt,
    dueDate: a.dueDate,
    maxScore: a.maxScore,
    attachments: a.attachments,
    submissionCount: a._count.submissions,
    files: a.attachments.map((key) => ({
      key,
      name: key.split("/").pop() ?? key,
      url: `/api/files/download/${encodeURIComponent(key)}?t=${signToken(key)}`,
    })),
  }));

  return (
    <ModuleAssignmentsClient
      course={{ id: course.id, title: course.title, slug: course.slug }}
      module={{
        id: mod.id,
        title: mod.title,
        order: mod.order,
        lessons: mod.lessons,
        assignments,
        quizzes: mod.quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          timeLimit: q.timeLimit,
          passingScore: q.passingScore,
          questionCount: q._count.questions,
          attemptCount: q._count.attempts,
        })),
        videos: videos.map((v) => ({
          id: v.id,
          lessonId: v.lessonId,
          lessonTitle: v.lesson.title,
          title: v.title,
          description: v.description,
          url: v.url,
          fileKey: v.fileKey,
          fileName: v.fileName,
          fileSize: v.fileSize,
          fileType: v.fileType,
          durationMin: v.durationMin,
          order: v.order,
          fileUrl: v.fileKey
            ? `/api/files/download/${encodeURIComponent(v.fileKey)}?t=${signToken(v.fileKey)}`
            : null,
        })),
      }}
      role={session.user.role === "ADMIN" ? "ADMIN" : "MANAGER"}
    />
  );
}
