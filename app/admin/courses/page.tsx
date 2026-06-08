// /admin/courses — server wrapper. Loads catalog data, gates the
// route, and hands the payload to the client view.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CoursesAdminClient, { type Course } from "./CoursesAdminClient";

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

  const initialCourses: Course[] = courses.map((c) => ({
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
  }));

  const role = session.user.role === "ADMIN" ? "ADMIN" : "MANAGER";

  return (
    <CoursesAdminClient
      initialCourses={initialCourses}
      instructors={instructors}
      managers={managers}
      role={role}
    />
  );
}
