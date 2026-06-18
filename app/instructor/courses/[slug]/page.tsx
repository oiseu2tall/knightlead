// /instructor/courses/[slug] — instructor course view: modules with
// attached course-module files + lesson completion info.
// Scoped to courses the instructor teaches (ADMIN can view all).

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, ProgressBar, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import { signToken } from "@/lib/storage";
import { ModuleFileLinks } from "@/components/files/ModuleFileLinks";
import { InstructorCourseModulesCard } from "@/components/layout/InstructorCourseModulesCard";




function lessonIconName(t: string): IconName {
  switch (t) {
    case "VIDEO": return "Video";
    case "ARTICLE": return "Article";
    case "QUIZ": return "Quiz";
    case "ASSIGNMENT": return "Assignment";
    default: return "Book";
  }
}

export default async function InstructorCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!course || !course.isPublished) notFound();

  if (role !== "ADMIN" && course.instructorId !== userId) {
    notFound();
  }

  // For instructors, we show each module's file and a basic lesson list.
  // We do not compute per-student completion here (that could be added
  // later); for now we show module-level completion status for "who"?
  // We'll omit completion badges except for module file availability.
  const hasModules = course.modules.length > 0;

  // Build a small nav. No dedicated instructor tabs exist in this repo.
  const subNavItems = [
    { href: "/instructor", label: "Overview", icon: "Dashboard" as IconName },
    { href: "/instructor/grading", label: "Grading", icon: "Assignment" as IconName },
    { href: "/instructor/cohorts", label: "Cohorts", icon: "Group" as IconName },
  ];

  return (
    <>
      <SubNav items={subNavItems} />

      <Breadcrumb
        items={[
          { label: "Teach", href: "/instructor" },
          { label: "Courses", href: "/instructor/courses" } as any,
          { label: course.title },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>Course</span>
            <Badge tone="success">published</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">Taught by you</p>
        </div>
        <Link
          href="/instructor"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          Back to Teach
        </Link>
      </div>

      <div className="mb-4">
        {(role === "INSTRUCTOR" || role === "ADMIN") && <InstructorCourseModulesCard />}
      </div>

      {hasModules ? (
        <div className="space-y-4">
          {course.modules.map((mod) => {
            const fileUrl = mod.fileKey
              ? `/api/files/download/${encodeURIComponent(mod.fileKey)}?t=${signToken(mod.fileKey)}`
              : null;

            return (
              <Card key={mod.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      <span>Module {mod.order}</span>
                      {fileUrl && <Badge tone="info">file attached</Badge>}
                    </div>
                    <h2 className="mt-0.5 text-lg font-semibold text-ink">{mod.title}</h2>

                    {mod.fileKey && mod.fileName && fileUrl && (
                      <div className="mt-2">
                        <ModuleFileLinks fileUrl={fileUrl} fileName={mod.fileName} />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[140px] flex-col items-end gap-1">
                    <span className="text-xs tabular-nums text-ink-muted">
                      {mod.lessons.length} {mod.lessons.length === 1 ? "lesson" : "lessons"}
                    </span>
                    <div className="w-32">
                      <ProgressBar value={0} />
                    </div>
                  </div>
                </div>

                <ul className="divide-y divide-line">
                  {mod.lessons.map((lesson) => {
                    const IconName = lessonIconName(lesson.contentType);
                    const I = Icon[IconName];
                    return (
                      <li key={lesson.id}>
                        <div className="flex items-center gap-3 -mx-2 rounded-md px-2 py-3 hover:bg-surface-dim">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border border-line bg-surface text-ink-muted">
                            <I className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{lesson.title}</p>
                            <p className="text-xs text-ink-muted">
                              {lesson.contentType.toLowerCase().replace("_", " ")}
                              {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
                            </p>
                          </div>
                          <Badge tone="neutral">Lesson</Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="Layers"
          title="No modules yet"
          description="You haven't published any modules in this course yet."
        />
      )}
    </>
  );
}

