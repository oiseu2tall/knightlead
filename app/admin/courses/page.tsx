// /admin/courses — list + create/edit form for courses.
// MANAGER + ADMIN.
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { CourseForm } from "./CourseForm";
import { CourseRow } from "./CourseRow";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata = { title: "Courses · Catalog" };

export default async function CoursesAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [courses, instructors, managers] = await Promise.all([
    db.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["INSTRUCTOR", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    db.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Manage · Courses"
        title="Courses"
        description={`${courses.length} ${courses.length === 1 ? "course" : "courses"} in the catalog`}
        accent="brand"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          {courses.length === 0 ? (
            <p className="text-sm text-ink-muted">No courses yet. Create one on the right.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Course</th>
                    <th className="py-2 pr-4 font-medium">Instructor</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Modules</th>
                    <th className="py-2 pr-4 font-medium">Enrolled</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {courses.map((c) => (
                    <CourseRow
                      key={c.id}
                      course={{
                        id: c.id,
                        title: c.title,
                        slug: c.slug,
                        description: c.description,
                        thumbnailUrl: c.thumbnailUrl,
                        instructorId: c.instructorId,
                        instructor: c.instructor,
                        managerId: c.managerId,
                        manager: c.manager,
                        isPublished: c.isPublished,
                        moduleCount: c._count.modules,
                        enrollmentCount: c._count.enrollments,
                      }}
                      instructors={instructors}
                      managers={managers}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div>
          <CourseForm mode="create" instructors={instructors} managers={managers} />
        </div>
      </div>
    </>
  );
}
