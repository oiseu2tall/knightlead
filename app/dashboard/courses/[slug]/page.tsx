// /dashboard/courses/[slug] — student course view: modules with
// completion state, per-module progress, and a sticky progress bar.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, ProgressBar, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon, type IconName } from "@/components/ui/Icon";

const LEARN_TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Dashboard" },
  { href: "/dashboard/courses", label: "My courses", icon: "School" },
  { href: "/dashboard/courses/browse", label: "Browse", icon: "Group" },
];

function lessonIconName(t: string): IconName {
  switch (t) {
    case "VIDEO": return "Video";
    case "ARTICLE": return "Article";
    case "QUIZ": return "Quiz";
    case "ASSIGNMENT": return "Assignment";
    default: return "Book";
  }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params; // Next 16: params is a Promise
  const session = await auth();
  const userId = session!.user.id;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!course || !course.isPublished) notFound();

  // Filter lessons for this course (LessonProgress has no `lesson`
  // relation, so we collect ids and count the rows whose `lessonId`
  // is in the set).
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completedLessons = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });

  // If the course exists + is published but the user isn't enrolled,
  // show an enrollment prompt instead of 404-ing.
  if (!enrollment) {
    return (
      <>
        <SubNav items={LEARN_TABS} />

        <Breadcrumb
          items={[
            { label: "Learn", href: "/dashboard" },
            { label: "My courses", href: "/dashboard/courses" },
            { label: course.title },
          ]}
        />

        <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <span>Course</span>
              <Badge tone="neutral">not enrolled</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Taught by{" "}
              <span className="font-medium text-ink">
                {course.instructor.name ?? "Instructor"}
              </span>
            </p>
          </div>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            My courses
          </Link>
        </div>

        <EmptyState
          icon="School"
          title="You're not enrolled yet"
          description="Enroll to access modules and track your lesson progress."
          action={
            course.isPublished ? { label: "Browse catalog", href: "/dashboard/courses/browse" } : null
          }
        />
      </>
    );
  }

  const completed = new Set(completedLessons.map((p) => p.lessonId));
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const completedCount = course.modules.reduce(
    (n, m) => n + m.lessons.filter((l) => completed.has(l.id)).length,
    0,
  );


  return (
    <>
      <SubNav items={LEARN_TABS} />

      <Breadcrumb
        items={[
          { label: "Learn", href: "/dashboard" },
          { label: "My courses", href: "/dashboard/courses" },
          { label: course.title },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>Course</span>
            {enrollment.status === "COMPLETED" && <Badge tone="success">completed</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Taught by{" "}
            <span className="font-medium text-ink">
              {course.instructor.name ?? "Instructor"}
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          My courses
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Your progress</p>
            <p className="text-xs text-ink-muted">
              {completedCount} of {totalLessons} lessons complete
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-1">
            <ProgressBar value={enrollment.progress} />
            <p className="self-end text-xs font-medium tabular-nums text-ink-muted">
              {enrollment.progress}%
            </p>
          </div>
        </div>
      </Card>

      {course.modules.length === 0 ? (
        <EmptyState
          icon="Layers"
          title="No modules yet"
          description="The instructor hasn't published any modules in this course yet."
        />
      ) : (
        <div className="space-y-4">
          {course.modules.map((mod) => {
            const modDone = mod.lessons.filter((l) => completed.has(l.id)).length;
            const modTotal = mod.lessons.length;
            const modPct = modTotal > 0 ? Math.round((modDone / modTotal) * 100) : 0;
            return (
              <Card key={mod.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      <span>Module {mod.order}</span>
                      {modPct === 100 && <Badge tone="success">done</Badge>}
                      {modPct > 0 && modPct < 100 && <Badge tone="info">in progress</Badge>}
                    </div>
                    <h2 className="mt-0.5 text-lg font-semibold text-ink">{mod.title}</h2>
                  </div>
                  <div className="flex min-w-[140px] flex-col items-end gap-1">
                    <span className="text-xs tabular-nums text-ink-muted">
                      {modDone}/{modTotal} lessons
                    </span>
                    <div className="w-32">
                      <ProgressBar value={modPct} />
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-line">
                  {mod.lessons.map((lesson) => {
                    const isDone = completed.has(lesson.id);
                    const IconName = lessonIconName(lesson.contentType);
                    const I = Icon[IconName];
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/dashboard/courses/${course.slug}/lessons/${lesson.id}`}
                          className="flex items-center gap-3 -mx-2 rounded-md px-2 py-3 hover:bg-surface-dim"
                        >
                          <span
                            className={[
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                              isDone
                                ? "bg-accent-500 text-ink shadow-[0_0_0_2px_var(--color-accent-100)]"
                                : "border border-line bg-surface text-ink-muted",
                            ].join(" ")}
                            aria-label={isDone ? "Completed" : "Not started"}
                          >
                            {isDone ? <Icon.Check className="h-4 w-4" /> : <I className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{lesson.title}</p>
                            <p className="text-xs text-ink-muted">
                              {lesson.contentType.toLowerCase().replace("_", " ")}
                              {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
                            </p>
                          </div>
                          <Badge tone={isDone ? "success" : "neutral"}>
                            {isDone ? "Done" : "Start"}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
