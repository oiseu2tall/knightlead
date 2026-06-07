// /dashboard/assignments — list of all assignments across the user's
// enrollments, with submission state.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "Assignments · Dashboard" };

export default async function AssignmentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Pull every assignment for enrolled courses, with the user's submission.
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    select: {
      course: {
        select: {
          slug: true,
          title: true,
          modules: {
            select: {
              lessons: {
                select: {
                  id: true,
                  title: true,
                  assignments: { select: { id: true, title: true, dueDate: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Flatten + join with submissions in a single query.
  const assignmentIds = enrollments
    .flatMap((e) => e.course.modules)
    .flatMap((m) => m.lessons)
    .flatMap((l) => l.assignments.map((a) => a.id));

  const submissions = await db.submission.findMany({
    where: { userId, assignmentId: { in: assignmentIds } },
    select: { assignmentId: true, status: true, score: true, submittedAt: true },
  });
  const subByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

  const rows = enrollments
    .flatMap((e) =>
      e.course.modules.flatMap((m) =>
        m.lessons.flatMap((l) =>
          l.assignments.map((a) => ({
            assignmentId: a.id,
            title: a.title,
            lessonId: l.id,
            lessonTitle: l.title,
            courseSlug: e.course.slug,
            courseTitle: e.course.title,
            dueDate: a.dueDate,
            submission: subByAssignment.get(a.id) ?? null,
          })),
        ),
      ),
    )
    .sort((a, b) => {
      // Pending first, then by due date asc, then graded by submittedAt desc.
      const ap = a.submission?.status === "GRADED" ? 1 : 0;
      const bp = b.submission?.status === "GRADED" ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
    });

  return (
    <>
      <PageHeader
        eyebrow="Learn · Assignments"
        title="Assignments"
        description={`${rows.length} total`}
        accent="brand"
      />
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">No assignments in your courses yet.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const tone =
                r.submission?.status === "GRADED" ? "success" :
                r.submission?.status === "SUBMITTED" ? "info" :
                r.dueDate && r.dueDate < new Date() ? "warning" : "neutral";
              return (
                <li key={r.assignmentId}>
                  <Link
                    href={`/dashboard/courses/${r.courseSlug}/lessons/${r.lessonId}`}
                    className="flex items-start justify-between gap-3 py-3 hover:bg-surface-dim -mx-2 px-2 rounded-md"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {r.courseTitle} · {r.lessonTitle}
                        {r.dueDate && ` · due ${r.dueDate.toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone={tone as "success" | "info" | "warning" | "neutral"}>
                        {r.submission?.status?.toLowerCase() ?? "not submitted"}
                      </Badge>
                      {r.submission?.score != null && (
                        <p className="mt-1 text-xs tabular-nums text-ink-muted">
                          {r.submission.score}/100
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
