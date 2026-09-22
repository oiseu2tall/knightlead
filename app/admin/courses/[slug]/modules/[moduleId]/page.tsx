// /admin/courses/[slug]/modules/[moduleId] — module detail with
// assignment CRUD for MANAGER + ADMIN.
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
        select: { id: true, title: true, contentType: true, content: true, videoUrl: true, durationMin: true, order: true, isFree: true },
      },
    },
  });
  if (!mod || mod.courseId !== course.id) notFound();

  // Fetch assignments through lessons since Module has no direct assignments relation.
  const lessonsWithAssignments = await db.lesson.findMany({
    where: { moduleId: mod.id },
    orderBy: { order: "asc" },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { submissions: true } } },
      },
    },
  });

  const assignments = lessonsWithAssignments.flatMap((l) =>
    l.assignments.map((a) => ({
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
      lessonId: l.id,
    })),
  );

  return (
    <ModuleAssignmentsClient
      course={{ id: course.id, title: course.title, slug: course.slug }}
      module={{
        id: mod.id,
        title: mod.title,
        order: mod.order,
        lessons: mod.lessons,
        assignments,
      }}
      role={session.user.role === "ADMIN" ? "ADMIN" : "MANAGER"}
    />
  );
}
