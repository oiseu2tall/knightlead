// /dashboard/assignments — every assignment across the user's live cohort
// seats, with submission state.
//
// Assessments are module-level, so this walks modules rather than lessons,
// and scopes to each seat's cohort plan: a module an intake never teaches
// is not work that student owes.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getInPlanModuleIds } from "@/lib/curriculum";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "Assignments · Dashboard" };

export default async function AssignmentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  // One row per seat, not per course: a student approved into two intakes
  // of the same course has two curricula and owes work in each.
  const seats = await db.enrollment.findMany({
    where: { userId, status: { not: "PENDING" } },
    select: {
      id: true,
      courseId: true,
      course: { select: { slug: true, title: true } },
      cohort: { select: { id: true, name: true } },
    },
  });

  // For each seat, work out which modules that intake delivers, then pull
  // their assignments. Modules are fetched in one batched query rather
  // than once per module.
  const moduleIdsBySeat = await Promise.all(
    seats.map((s) => getInPlanModuleIds(s.cohort.id, s.courseId)),
  );
  const allModuleIds = [...new Set(moduleIdsBySeat.flat())];

  const modules = await db.module.findMany({
    where: { id: { in: allModuleIds } },
    select: {
      id: true,
      title: true,
      course: { select: { slug: true, title: true } },
      assignments: {
        select: { id: true, title: true, dueDate: true, maxScore: true },
        orderBy: { dueDate: "asc" },
      },
    },
  });
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const rows = seats.flatMap((seat, seatIndex) => {
    const moduleIds = moduleIdsBySeat[seatIndex];
    return moduleIds.flatMap((moduleId) => {
      const moduleRow = moduleById.get(moduleId);
      if (!moduleRow) return [];
      return moduleRow.assignments.map((a) => ({
        assignmentId: a.id,
        seatId: seat.id,
        title: a.title,
        maxScore: a.maxScore,
        moduleId: moduleRow.id,
        moduleTitle: moduleRow.title,
        courseSlug: seat.course.slug,
        courseTitle: seat.course.title,
        cohortName: seat.cohort.name,
        dueDate: a.dueDate,
      }));
    });
  });

  const submissions = await db.submission.findMany({
    where: { userId, assignmentId: { in: rows.map((r) => r.assignmentId) } },
    select: { assignmentId: true, status: true, score: true, submittedAt: true },
  });
  // A student can owe the same assignment in two seats, so key the
  // submission by assignment+seat rather than assignment alone.
  const subByKey = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    for (const r of rows) {
      if (r.assignmentId === s.assignmentId) subByKey.set(`${r.seatId}:${r.assignmentId}`, s);
    }
  }

  const sorted = rows
    .map((r) => ({ ...r, submission: subByKey.get(`${r.seatId}:${r.assignmentId}`) ?? null }))
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
        description={`${sorted.length} total`}
        accent="brand"
      />
      {sorted.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">No assignments in your courses yet.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {sorted.map((r) => {
              const tone =
                r.submission?.status === "GRADED" ? "success" :
                r.submission?.status === "SUBMITTED" ? "info" :
                r.dueDate && r.dueDate < new Date() ? "warning" : "neutral";
              return (
                <li key={`${r.seatId}:${r.assignmentId}`}>
                  <Link
                    href={`/dashboard/courses/${r.courseSlug}?module=${r.moduleId}#assignment-${r.assignmentId}`}
                    className="flex items-start justify-between gap-3 py-3 hover:bg-surface-dim -mx-2 px-2 rounded-md"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {r.courseTitle} · {r.cohortName} · {r.moduleTitle}
                        {r.dueDate && ` · due ${r.dueDate.toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone={tone as "success" | "info" | "warning" | "neutral"}>
                        {r.submission?.status?.toLowerCase() ?? "not submitted"}
                      </Badge>
                      {r.submission?.score != null && (
                        <p className="mt-1 text-xs tabular-nums text-ink-muted">
                          {r.submission.score}/{r.maxScore}
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
