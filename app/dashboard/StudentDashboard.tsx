// Student dashboard — "Learn" workspace.
// Stats: active courses, completed, pending submissions, average score.
// Quick action: continue learning + browse catalog.
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard, ProgressBar, Badge } from "@/components/ui/Primitives";
import { ROLE_META } from "@/lib/role";

export default async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const [enrollments, submissions] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            title: true, slug: true,
            instructor: { select: { name: true } },
            _count: { select: { modules: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: 6,
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

  const nextLesson = enrollments.find((e) => e.status === "ACTIVE" && e.progress < 100);

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.STUDENT.plural} workspace</>}
        title={`Welcome back, ${name.split(" ")[0] ?? "learner"} 👋`}
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active courses"   value={active}    tone="brand" />
        <StatCard label="Completed"        value={completed} tone="accent" />
        <StatCard label="Pending reviews"  value={pending}   tone="brand" />
        <StatCard label="Average score"    value={avg != null ? `${avg}%` : "—"} tone="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" tinted>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Continue learning</h2>
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

        <div className="space-y-4">
          {nextLesson && (
            <Card tinted>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Up next</p>
              <p className="mt-1 line-clamp-2 text-base font-semibold text-ink">{nextLesson.course.title}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {nextLesson.course._count.modules} modules · {nextLesson.progress}% complete
              </p>
              <Link
                href={`/dashboard/courses/${nextLesson.course.slug}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Resume →
              </Link>
            </Card>
          )}

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
