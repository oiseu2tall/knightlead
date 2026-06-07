// /admin/courses/[slug] — modules for a single course.
// MANAGER + ADMIN can edit; instructors viewing their own course is a
// read-only /instructor concern.
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { ModuleForm, DeleteModuleButton } from "./ModuleForm";
import Link from "next/link";

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

  return (
    <>
      <PageHeader
        eyebrow="Manage · Courses · Modules"
        title={course.title}
        description={`${course.modules.length} ${course.modules.length === 1 ? "module" : "modules"} · taught by ${course.instructor.name ?? course.instructor.email}${course.manager ? ` · managed by ${course.manager.name ?? course.manager.email}` : ""}`}
        accent="brand"
        action={
          <Link
            href="/admin/courses"
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            ← All courses
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          {course.modules.length === 0 ? (
            <p className="text-sm text-ink-muted">No modules yet. Add the first one on the right.</p>
          ) : (
            <ol className="space-y-3">
              {course.modules.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-muted">Order {m.order}</p>
                    <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                    <p className="text-xs text-ink-muted">{m._count.lessons} lesson(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">module</Badge>
                    <DeleteModuleButton id={m.id} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div>
          <ModuleForm
            courseId={course.id}
            nextOrder={(course.modules[course.modules.length - 1]?.order ?? 0) + 1}
          />
        </div>
      </div>
    </>
  );
}
