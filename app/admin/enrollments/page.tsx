// /admin/enrollments — staff-initiated enrollment tool.
// MANAGER + ADMIN can enroll any STUDENT in any course, optionally
// tagged with a cohort. INSTRUCTORs cannot reach this page.
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { EnrollStudentForm } from "./EnrollStudentForm";

export const metadata = { title: "Enrollments · Catalog" };

export default async function EnrollmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [students, courses, cohorts, recent] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    db.course.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, isPublished: true },
    }),
    db.cohort.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true },
    }),
    db.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 15,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, slug: true } },
        cohort: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Manage · Enrollments"
        title="Enrollments"
        description="Enroll a student in a course. Optionally tag with a cohort."
        accent="brand"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent enrollments</h2>
            <p className="text-xs text-ink-muted">Last {recent.length}</p>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-muted">No enrollments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Course</th>
                    <th className="py-2 pr-4 font-medium">Cohort</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((e) => (
                    <tr key={e.id} className="text-ink">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/users/${e.user.id}`}
                          className="font-medium text-ink hover:text-brand-600"
                        >
                          {e.user.name ?? e.user.email}
                        </Link>
                        <p className="text-[11px] text-ink-muted">{e.user.email}</p>
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/courses/${e.course.slug}`}
                          className="text-ink hover:text-brand-600"
                        >
                          {e.course.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-xs text-ink-muted">
                        {e.cohort ? e.cohort.name : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={e.status === "COMPLETED" ? "success" : e.status === "ACTIVE" ? "info" : "neutral"}>
                          {e.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-ink-muted">
                        {e.enrolledAt.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">New enrollment</h2>
          {students.length === 0 ? (
            <p className="text-sm text-ink-muted">No students in the system yet.</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-ink-muted">No courses in the catalog yet. Create one first.</p>
          ) : (
            <EnrollStudentForm students={students} courses={courses} cohorts={cohorts} />
          )}
        </Card>
      </div>
    </>
  );
}
