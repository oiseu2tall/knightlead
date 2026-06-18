// /instructor/course-modules — instructor view of all module attachments
// across courses they teach (ADMIN can view all).

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SubNav } from "@/components/layout/SubNav";
import Link from "next/link";
import { signToken } from "@/lib/storage";
import { ModuleFileLinks } from "@/components/files/ModuleFileLinks";

export const metadata = { title: "Course modules · Instructor" };

type CourseRow = {
  slug: string;
  title: string;
  modules: Array<{
    id: string;
    order: number;
    title: string;
    fileKey: string | null;
    fileName: string | null;
    lessonsCount: number;
  }>;
};

export default async function InstructorCourseModulesPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const userId = session.user.id;
  const role = session.user.role;

  const courses = await db.course.findMany({
    where:
      role === "ADMIN"
        ? {
            isPublished: true,
          }
        : {
            instructorId: userId,
            isPublished: true,
          },
    orderBy: { createdAt: "desc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        where: {
          OR: [{ fileKey: { not: null } }, { fileName: { not: null } }],
        },
        select: {
          id: true,
          order: true,
          title: true,
          fileKey: true,
          fileName: true,
          lessons: {
            select: { id: true },
          },
        },
      },
    },
    take: 100,
  });

  const rows: CourseRow[] = courses.map((c) => ({
    slug: c.slug,
    title: c.title,
    modules: c.modules.map((m) => ({
      id: m.id,
      order: m.order,
      title: m.title,
      fileKey: m.fileKey,
      fileName: m.fileName,
      // lessons is included via select; keep it typed
      lessonsCount: (m.lessons ? m.lessons.length : 0),
    })),
  }));


  const totalModules = rows.reduce((acc, r) => acc + r.modules.length, 0);

  const subNavItems = [
    { href: "/instructor", label: "Overview", icon: "Dashboard" },
    { href: "/instructor/grading", label: "Grading", icon: "Assignment" },
    { href: "/instructor/cohorts", label: "Cohorts", icon: "Group" },
    { href: "/instructor/course-modules", label: "Course modules", icon: "Layers" },
  ];

  return (
    <>
      <SubNav items={subNavItems} />


      <Breadcrumb
        items={[
          { label: "Teach", href: "/instructor" },
          { label: "Course modules" },
        ]}
      />

      {totalModules === 0 ? (
        <EmptyState
          icon="Layers"
          title="No module files"
          description="Your published courses don't have any module attachments yet."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((course) => (
            <Card key={course.slug} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="success">published</Badge>
                    <Link
                      href={`/instructor/courses/${course.slug}`}
                      className="truncate text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {course.title}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {course.modules.length} {course.modules.length === 1 ? "module" : "modules"}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {course.modules.map((mod) => {
                  const fileUrl = mod.fileKey
                    ? `/api/files/download/${encodeURIComponent(mod.fileKey)}?t=${signToken(mod.fileKey)}`
                    : null;

                  return (
                    <div key={mod.id} className="rounded-lg border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                            Module {mod.order}
                          </div>
                          <div className="mt-1 text-base font-semibold text-ink">{mod.title}</div>
                          <div className="mt-1 text-xs text-ink-muted">
                            {mod.lessonsCount} lesson{mod.lessonsCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        {fileUrl && mod.fileName ? (
                          <div className="w-full sm:w-auto">
                            <ModuleFileLinks fileUrl={fileUrl} fileName={mod.fileName} />
                          </div>
                        ) : (
                          <div>
                            <Badge tone="neutral">No file</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

