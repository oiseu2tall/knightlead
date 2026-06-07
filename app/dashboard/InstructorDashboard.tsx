// Instructor dashboard — "Teach" workspace.
// Stats scoped to the instructor's own courses:
//   - submissions awaiting grade
//   - students taught (active enrollments in their courses)
//   - graded in the last 7 days
//   - average score across graded work
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard, Badge } from "@/components/ui/Primitives";
import { ROLE_META } from "@/lib/role";

export default async function InstructorDashboard({ userId, name }: { userId: string; name: string }) {
  // The instructor dashboard always runs in the instructor's own
  // scope. If a different role needs the same data shape, the
  // dispatcher should route to a different server component.
  const courseWhere = { instructorId: userId };

  const [pendingCount, taughtCourses, recentSubmissions, cohorts, graded7d, gradedAll] = await Promise.all([
    db.submission.count({
      where: {
        status: "SUBMITTED",
        assignment: { lesson: { module: { course: courseWhere } } },
      },
    }),
    db.course.findMany({
      where: courseWhere,
      select: { id: true, title: true, slug: true, isPublished: true, _count: { select: { modules: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.submission.findMany({
      where: { assignment: { lesson: { module: { course: courseWhere } } } },
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: {
        user: { select: { name: true, email: true } },
        assignment: {
          select: {
            title: true,
            maxScore: true,
            lesson: { select: { module: { select: { course: { select: { title: true, slug: true } } } } } },
          },
        },
      },
    }),
    db.cohort.findMany({
      where: { enrollments: { some: { course: courseWhere } } },
      select: { id: true, name: true, startDate: true, endDate: true, _count: { select: { enrollments: true } } },
      orderBy: { startDate: "desc" },
      take: 4,
    }),
    db.submission.findMany({
      where: {
        status: "GRADED",
        gradedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        assignment: { lesson: { module: { course: courseWhere } } },
      },
      select: { score: true },
    }),
    db.submission.findMany({
      where: {
        status: "GRADED",
        assignment: { lesson: { module: { course: courseWhere } } },
      },
      select: { score: true },
    }),
  ]);

  const taughtCount = taughtCourses.reduce((n, c) => n + c._count.enrollments, 0);
  const avg = gradedAll.length
    ? Math.round(gradedAll.reduce((a, s) => a + (s.score ?? 0), 0) / gradedAll.length)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.INSTRUCTOR.plural} workspace</>}
        title={`Hi ${name.split(" ")[0] ?? "instructor"} 👋`}
        description="Here's what's waiting for you in the courses you teach."
        action={
          <Link
            href="/instructor/grading"
            className="inline-flex items-center gap-1.5 rounded-lg bg-hero px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] hover:opacity-95"
          >
            Open grading queue →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting grade" value={pendingCount} tone="accent" />
        <StatCard label="Students taught" value={taughtCount} tone="brand" />
        <StatCard label="Graded this week" value={graded7d.length} tone="brand" />
        <StatCard label="Average score" value={avg != null ? `${avg}%` : "—"} tone="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" tinted>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recent submissions</h2>
            <Link href="/instructor/grading" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              Open queue
            </Link>
          </div>
          {recentSubmissions.length === 0 ? (
            <p className="text-sm text-ink-muted">No submissions in your courses yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentSubmissions.map((s) => {
                const tone =
                  s.status === "GRADED" ? "success" :
                  s.status === "LATE" ? "warning" :
                  s.status === "RETURNED" ? "info" : "neutral";
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{s.assignment.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {s.user.name ?? s.user.email} · {s.assignment.lesson.module.course.title}
                      </p>
                    </div>
                    <span className="hidden text-xs text-ink-muted sm:inline">
                      {s.submittedAt.toLocaleDateString()}
                    </span>
                    <Badge tone={tone as "success" | "warning" | "info" | "neutral"}>
                      {s.status.toLowerCase()}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">My cohorts</h2>
              <Link href="/instructor/cohorts" className="text-xs font-medium text-brand-500 hover:text-brand-600">
                All
              </Link>
            </div>
            {cohorts.length === 0 ? (
              <p className="text-sm text-ink-muted">No cohorts linked to your courses yet.</p>
            ) : (
              <ul className="space-y-3">
                {cohorts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-[11px] text-ink-muted">
                        {c.startDate.toLocaleDateString()} → {c.endDate.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone="info">{c._count.enrollments}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Your courses</h2>
            {taughtCourses.length === 0 ? (
              <p className="text-sm text-ink-muted">
                You don't teach any courses yet. Ask a manager to assign you.
              </p>
            ) : (
              <ul className="space-y-3">
                {taughtCourses.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/courses/${c.slug}`}
                      className="block rounded p-1 -mx-1 hover:bg-surface-dim"
                    >
                      <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                      <p className="text-[11px] text-ink-muted">
                        {c._count.enrollments} students · {c._count.modules} modules · {c.isPublished ? "published" : "draft"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
