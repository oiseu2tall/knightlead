// /instructor/cohorts — read-only view of cohorts that the current
// instructor's courses are attached to. Instructors manage students
// and grading; they do NOT create or edit cohorts (that's the
// manager's job).
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
  //   - INSTRUCTOR: cohorts that contain at least one enrollment in a
  //     course they teach, OR cohorts that are referenced by an
  //     enrollment for one of their courses. The catalog also lets a
  //     cohort exist with no enrollments; those don't show up here
  //     because the instructor has no connection to them yet.
  //   - ADMIN: sees every cohort.
  const isAdmin = session.user.role === "ADMIN";

  const cohorts = isAdmin
    ? await db.cohort.findMany({
        orderBy: { startDate: "desc" },
        include: {
          manager: { select: { name: true, email: true } },
          _count: { select: { enrollments: true } },
          enrollments: {
            select: {
              course: { select: { title: true, slug: true, instructorId: true } },
            },
          },
        },
      })
    : await db.cohort.findMany({
        where: {
          enrollments: {
            some: { course: { instructorId: session.user.id } },
          },
        },
        orderBy: { startDate: "desc" },
        include: {
          manager: { select: { name: true, email: true } },
          _count: { select: { enrollments: true } },
          enrollments: {
            where: { course: { instructorId: session.user.id } },
            select: { course: { select: { title: true, slug: true } } },
          },
        },
      });

  return (
    <>
      <PageHeader
        eyebrow="Teach · Cohorts"
        title="My cohorts"
        description={
          isAdmin
            ? "All cohorts in the catalog (admin view)."
            : "Cohorts that contain students in courses you teach."
        }
        accent="accent"
      />

      {cohorts.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {isAdmin
              ? "No cohorts in the catalog yet."
              : "You don't have any cohorts yet. Cohorts appear here once students enroll in your courses through them."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((c) => {
            // Unique course titles in this cohort (from the instructor's perspective).
            const courses = Array.from(
              new Map(
                c.enrollments.map((e) => [
                  e.course.slug,
                  e.course as { title: string; slug: string },
                ]),
              ).values(),
            );
            return (
              <Card key={c.id} className="h-full">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{c.name}</h3>
                  <Badge tone="info">{c._count.enrollments}</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {c.startDate.toLocaleDateString()} → {c.endDate.toLocaleDateString()}
                </p>
                {c.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{c.description}</p>
                )}
                {courses.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Your courses in this cohort
                    </p>
                    <ul className="mt-1 space-y-1">
                      {courses.map((cs) => (
                        <li key={cs.slug}>
                          <Link
                            href={`/dashboard/courses/${cs.slug}`}
                            className="text-sm font-medium text-brand-500 hover:text-brand-600"
                          >
                            {cs.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-ink-muted">
                  Manager: {c.manager ? (c.manager.name ?? c.manager.email) : "— Unassigned —"}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-ink-muted">
          Need to change cohort details? Ask a manager — instructors don't
          edit cohorts, courses, or modules.
        </p>
      )}
    </>
  );
}
