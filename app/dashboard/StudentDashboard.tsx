// Student dashboard — "Learn" workspace.
// Hero "Continue learning" card on top, then stats, then continue
// learning list and recent submissions.

import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard, ProgressBar, Badge } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { ROLE_META } from "@/lib/role";

export default async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const [enrollments, submissions] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: { select: { name: true } },
            modules: {
              orderBy: { order: "asc" },
              select: {
                lessons: {
                  orderBy: { order: "asc" },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
    }),
    db.submission.findMany({
      where: { userId },
      include: { assignment: { select: { title: true, maxScore: true } } },
      take: 5,
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const active = enrollments.filter((e) => e.status === "ACTIVE").length;
  const completed = enrollments.filter((e) => e.status === "COMPLETED").length;
  const pending = submissions.filter((s) => s.status === "SUBMITTED").length;
  const graded = submissions.filter((s) => s.score != null);
  const avg = graded.length
    ? Math.round(graded.reduce((a, s) => a + (s.score ?? 0), 0) / graded.length)
    : null;

  // Pick the most recently-touched active course to feature.
  const featured =
    enrollments.find((e) => e.status === "ACTIVE" && e.progress < 100) ?? null;

  // For the featured course, find the next lesson the student hasn't
  // completed yet, so the hero CTA can deep-link into the lesson.
  let featuredNextLessonId: string | null = null;
  if (featured) {
    const allLessonIds = featured.course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const done = allLessonIds.length
      ? await db.lessonProgress.findMany({
          where: { userId, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : [];
    const doneSet = new Set(done.map((d) => d.lessonId));
    for (const m of featured.course.modules) {
      for (const l of m.lessons) {
        if (!doneSet.has(l.id)) {
          featuredNextLessonId = l.id;
          break;
        }
      }
      if (featuredNextLessonId) break;
    }
  }

  const firstName = name.split(" ")[0] ?? "learner";
  const lessonCount = featured
    ? featured.course.modules.reduce((n, m) => n + m.lessons.length, 0)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.STUDENT.plural} workspace</>}
        title={`Welcome back, ${firstName} 👋`}
        description="Pick up where you left off, or discover a new course."
        action={
          <Link
            href="/dashboard/courses/browse"
            className="inline-flex items-center gap-1.5 rounded-lg bg-hero px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] hover:opacity-95"
          >
            Browse catalog →
          </Link>
        }
      />

      {featured && (
        <Link
          href={
            featuredNextLessonId
              ? `/dashboard/courses/${featured.course.slug}/lessons/${featuredNextLessonId}`
              : `/dashboard/courses/${featured.course.slug}`
          }
          className="group block focus:outline-none"
        >
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-hero text-white shadow-[var(--shadow-pop)] transition-transform hover:-translate-y-0.5">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]"
            />
            <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  Continue learning
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {featured.course.title}
                </h2>
                <p className="mt-1 text-sm text-white/85">
                  {featured.course.instructor.name ?? "Instructor"} ·{" "}
                  {featured.course.modules.length} modules · {lessonCount} lessons
                </p>
                <div className="mt-4 max-w-md">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/90">
                      {featured.progress === 0
                        ? "Just getting started"
                        : featured.progress === 100
                          ? "Completed!"
                          : "You're making progress"}
                    </span>
                    <span className="font-bold tabular-nums">{featured.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-700"
                      style={{ width: `${featured.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-opacity group-hover:opacity-95">
                    <Icon.Play className="h-4 w-4" />
                    {featuredNextLessonId ? "Resume next lesson" : "Open course"}
                    <Icon.ArrowRight className="h-4 w-4" />
                  </span>
                  <span className="text-xs text-white/80">
                    {featuredNextLessonId
                      ? "Picks up exactly where you left off"
                      : "Review the modules"}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur">
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums">{featured.progress}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/70">complete</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active courses" value={active} tone="brand" />
        <StatCard label="Completed" value={completed} tone="accent" />
        <StatCard label="Pending reviews" value={pending} tone="brand" />
        <StatCard label="Average score" value={avg != null ? `${avg}%` : "—"} tone="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" tinted>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">All enrolled courses</h2>
            <Link href="/dashboard/courses" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all
            </Link>
          </div>
          {enrollments.length === 0 ? (
            <EmptyEnrollments />
          ) : (
            <ul className="space-y-4">
              {enrollments.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/courses/${e.course.slug}`}
                    className="block rounded-lg p-2 -mx-2 hover:bg-surface-dim"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-ink">{e.course.title}</p>
                      <span className="text-xs font-medium tabular-nums text-ink-muted">{e.progress}%</span>
                    </div>
                    <ProgressBar value={e.progress} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-ink-muted">No submissions yet.</p>
          ) : (
            <ul className="space-y-3">
              {submissions.map((s) => {
                const tone =
                  s.status === "GRADED" ? "success" :
                  s.status === "LATE" ? "warning" :
                  s.status === "RETURNED" ? "info" : "neutral";
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{s.assignment.title}</p>
                      <p className="text-xs text-ink-muted">
                        {s.score != null ? `Scored ${s.score}/${s.assignment.maxScore}` : "Awaiting grade"}
                      </p>
                    </div>
                    <Badge tone={tone as "success" | "warning" | "info" | "neutral"}>
                      {s.status.toLowerCase()}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function EmptyEnrollments() {
  return (
    <p className="text-sm text-ink-muted">
      You haven't enrolled in any courses yet.{" "}
      <Link href="/dashboard/courses/browse" className="font-medium text-brand-500 hover:text-brand-600">
        Browse the catalog
      </Link>{" "}
      to get started.
    </p>
  );
}
