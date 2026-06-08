// /dashboard/courses/browse — server wrapper.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import BrowseClient, { type LearnTab } from "./BrowseClient";

export const metadata = { title: "Browse courses · Dashboard" };

const TABS: LearnTab[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Dashboard", countKey: "all" },
  { href: "/dashboard/courses", label: "My courses", icon: "School", countKey: "all" },
  { href: "/dashboard/courses/browse", label: "Browse", icon: "Group", countKey: "all" },
];

export default async function BrowseCourses() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;

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

  const enrolledMap = new Map(enrolledRows.map((e) => [e.courseId, e.status]));

  return (
    <BrowseClient
      canEnroll={role === "STUDENT"}
      tabs={TABS}
      courses={courses.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        instructor: c.instructor,
        moduleCount: c._count.modules,
        enrollmentCount: c._count.enrollments,
        enrolled: enrolledMap.get(c.id) ?? null,
      }))}
    />
  );
}
