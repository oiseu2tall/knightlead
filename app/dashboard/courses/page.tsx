// /dashboard/courses — list of enrolled courses with progress.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, ProgressBar, Badge } from "@/components/ui/Primitives";
import Link from "next/link";

export const metadata = { title: "My courses · Dashboard" };

export default async function MyCourses() {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          instructor: { select: { name: true } },
          _count: { select: { modules: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Learn · My courses"
        title="My courses"
        description={`${enrollments.length} ${enrollments.length === 1 ? "course" : "courses"} enrolled.`}
        accent="brand"
        action={
          <Link
            href="/dashboard/courses/browse"
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Browse catalog →
          </Link>
        }
      />
      {enrollments.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {role === "STUDENT"
              ? "You haven't enrolled in any courses yet. "
              : "You're not enrolled in any courses. Staff accounts don't take courses — you supervise the catalog."}
            {role === "STUDENT" && (
              <Link
                href="/dashboard/courses/browse"
                className="font-medium text-brand-500 hover:text-brand-600"
              >
                Browse the catalog.
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/courses/${e.course.slug}`}
              className="group block focus:outline-none"
            >
              <Card className="card-hover relative h-full overflow-hidden pt-7">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-hero transition-transform duration-200 group-hover:scale-x-100"
                />
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-base font-semibold text-ink">{e.course.title}</h3>
                  <Badge tone={e.status === "COMPLETED" ? "success" : e.status === "ACTIVE" ? "info" : "neutral"}>
                    {e.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {e.course.instructor.name ?? "Instructor"} · {e.course._count.modules} modules
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Progress</span>
                    <span className="font-medium tabular-nums text-ink">{e.progress}%</span>
                  </div>
                  <ProgressBar value={e.progress} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
