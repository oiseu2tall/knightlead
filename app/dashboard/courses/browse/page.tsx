// /dashboard/courses/browse — published course catalog.
// Only STUDENTs can enroll; INSTRUCTOR / MANAGER / ADMIN see the
// catalog but with a "Staff view" notice and no enroll button.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { EnrollButton } from "./EnrollButton";

export const metadata = { title: "Browse courses · Dashboard" };

export default async function BrowseCourses() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;

  // For non-students, still show the catalog but as a read-only staff view.
  const canEnroll = role === "STUDENT";

  const [courses, enrolledRows] = await Promise.all([
    db.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { name: true, email: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
    db.enrollment.findMany({
      where: { userId: session.user.id },
      select: { courseId: true, status: true },
    }),
  ]);

  const enrolledSet = new Map(enrolledRows.map((e) => [e.courseId, e.status]));

  return (
    <>
      <PageHeader
        eyebrow="Learn · Browse catalog"
        title="Browse courses"
        description={
          canEnroll
            ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} available.`
            : "You're viewing the catalog as staff. Enrollment is for students only."
        }
        accent="brand"
      />

      {!canEnroll && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong className="font-semibold">Staff view:</strong> you can browse
          the catalog, but enrollment is restricted to students. Switch to a
          student account to enroll.
        </div>
      )}

      {courses.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">No published courses yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const status = enrolledSet.get(c.id);
            return (
              <Card key={c.id} className="flex h-full flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-base font-semibold text-ink">{c.title}</h3>
                  {status && (
                    <Badge tone={status === "COMPLETED" ? "success" : "info"}>
                      {status.toLowerCase()}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-muted">
                  {c.instructor.name ?? c.instructor.email} · {c._count.modules} modules
                </p>
                {c.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{c.description}</p>
                )}
                <div className="mt-auto pt-4">
                  {canEnroll ? (
                    status ? (
                      <span className="text-xs text-ink-muted">You're already enrolled.</span>
                    ) : (
                      <EnrollButton courseId={c.id} />
                    )
                  ) : (
                    <span className="text-xs text-ink-muted">Enrollment disabled for staff accounts.</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
