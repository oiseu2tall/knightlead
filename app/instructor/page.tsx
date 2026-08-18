// /instructor — instructor dashboard / overview.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "Instructor dashboard" };

export default async function InstructorDashboard() {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const isAdmin = role === "ADMIN";

  const [courseCount, pendingSubmissions, cohortCount] = await Promise.all([
    db.course.count({ where: isAdmin ? {} : { instructorId: userId } }),
    db.submission.count({
      where: {
        status: "SUBMITTED",
        ...(isAdmin ? {} : { assignment: { lesson: { module: { course: { instructorId: userId } } } } }),
      },
    }),
    db.enrollment.count({
      where: {
        ...(isAdmin ? {} : { course: { instructorId: userId } }),
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Teach"
        title="Instructor dashboard"
        description={isAdmin ? "All courses (admin view)." : "Your teaching overview."}
        accent="accent"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <Link href="/instructor/courses" className="block p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Courses
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{courseCount}</div>
            <div className="mt-1 text-xs text-ink-muted">Courses you teach</div>
          </Link>
        </Card>
        <Card>
          <Link href="/instructor/grading" className="block p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Pending submissions
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{pendingSubmissions}</div>
            <div className="mt-1 text-xs text-ink-muted">Awaiting review</div>
          </Link>
        </Card>
        <Card>
          <Link href="/instructor/cohorts" className="block p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Enrollments
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{cohortCount}</div>
            <div className="mt-1 text-xs text-ink-muted">Active students</div>
          </Link>
        </Card>
      </div>
    </>
  );
}
