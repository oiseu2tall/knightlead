// /admin/courses/[slug] — server wrapper. Loads the course, modules,
// role, and hands the payload to the client view.
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CourseModulesClient, { type ModuleRow } from "./CourseModulesClient";

export const metadata = { title: "Course modules · Catalog" };

export default async function CourseModulesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true, email: true } },
      manager: { select: { name: true, email: true } },
      modules: {
        orderBy: { order: "asc" },
        include: { _count: { select: { lessons: true } } },
      },
    },
  });
  if (!course) notFound();

  const initialModules: ModuleRow[] = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    fileKey: m.fileKey,
    fileName: m.fileName,
    lessonCount: m._count.lessons,
  }));

  // Roll up total lesson count for the header.
  const lessonCount = initialModules.reduce((n, m) => n + m.lessonCount, 0);

  return (
    <CourseModulesClient
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        isPublished: course.isPublished,
        moduleCount: initialModules.length,
        lessonCount,
        instructor: course.instructor,
        manager: course.manager,
      }}
      initialModules={initialModules}
      role={session.user.role === "ADMIN" ? "ADMIN" : "MANAGER"}
    />
  );
}
