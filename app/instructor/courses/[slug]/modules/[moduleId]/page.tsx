// /instructor/courses/[slug]/modules/[moduleId] — read-only module
// view for INSTRUCTOR + ADMIN. Shows lessons + assignments with
// submission counts and quick links to the grading queue.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon, type IconName } from "@/components/ui/Icon";
import { signToken } from "@/lib/storage";
import Link from "next/link";

function lessonIconName(t: string): IconName {
  switch (t) {
    case "VIDEO": return "Video";
    case "ARTICLE": return "Article";
    case "QUIZ": return "Quiz";
    case "ASSIGNMENT": return "Assignment";
    default: return "Book";
  }
}

export default async function InstructorModulePage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true } },
      modules: {
        where: { id: moduleId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          fileKey: true,
          fileName: true,
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!course || !course.isPublished) notFound();
  if (role !== "ADMIN" && course.instructorId !== userId) notFound();

  const mod = course.modules[0];
  if (!mod) notFound();

  // Fetch assignments through lessons.
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
      _count: a._count,
    })),
  );

  const fileUrl = mod.fileKey
    ? `/api/files/download/${encodeURIComponent(mod.fileKey)}?t=${signToken(mod.fileKey)}`
    : null;

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
          { label: "Courses", href: "/instructor/courses" },
          { label: course.title, href: `/instructor/courses/${course.slug}` },
          { label: `Module ${mod.order}` },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>Module {mod.order}</span>
            <span>·</span>
            <span>{mod.lessons.length} lessons</span>
            <span>·</span>
            <span>{assignments.length} assignments</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{mod.title}</h1>
          {fileUrl && (
            <div className="mt-2">
              <a
                href={fileUrl}
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
              >
                <Icon.File className="h-4 w-4" />
                {mod.fileName ?? "Download module file"}
              </a>
            </div>
          )}
        </div>
        <Link
          href={`/instructor/courses/${course.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          Back to course
        </Link>
      </div>

      {mod.lessons.length === 0 && assignments.length === 0 ? (
        <EmptyState
          icon="Layers"
          title="No content yet"
          description="This module has no lessons or assignments."
        />
      ) : (
        <div className="space-y-6">
          {mod.lessons.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Lessons</h2>
              <ul className="divide-y divide-line">
                {mod.lessons.map((lesson: typeof mod.lessons[0]) => {
                  const IconName = lessonIconName(lesson.contentType);
                  const I = Icon[IconName];
                  return (
                    <li key={lesson.id}>
                      <div className="flex items-center gap-3 -mx-2 rounded-md px-2 py-3 hover:bg-surface-dim">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted">
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
          )}

          {assignments.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Assignments</h2>
              <ul className="divide-y divide-line">
                {assignments.map((a: typeof assignments[0]) => (
                  <li key={a.id}>
                    <div className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{a.prompt}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          <span>Max {a.maxScore} pts</span>
                          {a.dueDate && (
                            <>
                              <span>·</span>
                              <span>Due {new Date(a.dueDate).toLocaleString()}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{a._count.submissions} submission{a._count.submissions === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <a
                          href={`/instructor/grading?assignmentId=${a.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-dim"
                        >
                          View submissions
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
