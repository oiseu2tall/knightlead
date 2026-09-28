// /instructor/cohorts — read-only view of the cohorts belonging to the
// current instructor's courses. Instructors manage students and grading;
// they do NOT create or edit cohorts (that's the manager's job).
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "Cohorts · Instructor" };

export default async function InstructorCohorts() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Layout/proxy already gate INSTRUCTOR + ADMIN, but be explicit.
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  // Scoping:
  //   - INSTRUCTOR: cohorts of the courses they teach. Because a cohort
  //     now belongs to exactly one course, this is a direct courseId
  //     lookup — no need to go through enrollments, so an intake with no
  //     students yet still shows up.
  //   - ADMIN: every cohort.
  const isAdmin = session.user.role === "ADMIN";

  const cohorts = await db.cohort.findMany({
    where: isAdmin ? {} : { course: { instructorId: session.user.id } },
    orderBy: [{ course: { title: "asc" } }, { startDate: "desc" }],
    include: {
      course: { select: { id: true, title: true, slug: true } },
      manager: { select: { name: true, email: true } },
      _count: { select: { enrollments: true } },
    },
  });

  // Group by course so an instructor reads down the intakes of each course
  // rather than scanning a flat wall of cards.
  const byCourse = new Map<
    string,
    { course: (typeof cohorts)[number]["course"]; cohorts: typeof cohorts }
  >();
  for (const c of cohorts) {
    let group = byCourse.get(c.course.id);
    if (!group) {
      group = { course: c.course, cohorts: [] };
      byCourse.set(c.course.id, group);
    }
    group.cohorts.push(c);
  }
  const groups = Array.from(byCourse.values());

  return (
    <>
      <PageHeader
        eyebrow="Teach · Cohorts"
        title="My cohorts"
        description={
          isAdmin
            ? "All cohorts in the catalog, grouped by course (admin view)."
            : "Intakes of the courses you teach, grouped by course."
        }
        accent="accent"
      />

      {cohorts.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {isAdmin
              ? "No cohorts in the catalog yet."
              : "You don't have any cohorts yet. Cohorts appear here once a manager creates an intake for one of your courses."}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.course.id}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {group.course.title}
                </h2>
                <Link
                  href={`/dashboard/courses/${group.course.slug}`}
                  className="text-xs font-semibold text-brand-500 hover:text-brand-600"
                >
                  View course →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.cohorts.map((c) => (
                  <Card key={c.id} className="h-full">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink">{c.name}</h3>
                      <div className="flex items-center gap-1">
                        {!c.isOpen && <Badge tone="warning">closed</Badge>}
                        <Badge tone="info">
                          {c.capacity === null
                            ? `${c._count.enrollments}`
                            : `${c._count.enrollments}/${c.capacity}`}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {c.startDate.toLocaleDateString()} → {c.endDate.toLocaleDateString()}
                    </p>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{c.description}</p>
                    )}
                    <p className="mt-3 text-[11px] text-ink-muted">
                      {c._count.enrollments}{" "}
                      {c._count.enrollments === 1 ? "student" : "students"}
                      {c.capacity !== null && ` of ${c.capacity} seats`}
                      {!c.isOpen && " · closed to self-enrollment"}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Manager:{" "}
                      {c.manager ? (c.manager.name ?? c.manager.email) : "— Unassigned —"}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-ink-muted">
          Need to change cohort details? Ask a manager — instructors don&apos;t
          edit cohorts, courses, or modules.
        </p>
      )}
    </>
  );
}
