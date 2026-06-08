// /dashboard/courses — server wrapper. Loads the user's enrollments
// and hands them to the client view.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import MyCoursesClient, { type LearnTab } from "./MyCoursesClient";

export const metadata = { title: "My courses · Dashboard" };

const TABS: LearnTab[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Dashboard", countKey: "all" },
  { href: "/dashboard/courses", label: "My courses", icon: "School", countKey: "all" },
  { href: "/dashboard/courses/browse", label: "Browse", icon: "Group", countKey: "all" },
];

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
    <MyCoursesClient
      enrollments={enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        progress: e.progress,
        enrolledAt: e.enrolledAt.toISOString(),
        course: {
          title: e.course.title,
          slug: e.course.slug,
          instructor: { name: e.course.instructor.name },
          moduleCount: e.course._count.modules,
        },
      }))}
      role={role}
      tabs={TABS}
    />
  );
}
