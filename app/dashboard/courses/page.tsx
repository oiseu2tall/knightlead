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

  // One row per seat, not per course: a student enrolled in two intakes of
  // the same course gets two entries, each showing which cohort it belongs
  // to. Dropped and suspended seats are kept so the student can see the
  // outcome rather than having rows silently vanish.
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: {
      // The course comes through the cohort — that is the authoritative
      // link, and it means an inconsistent denormalized courseId can never
      // mislabel a student's seat.
      cohort: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          course: {
            include: {
              instructor: { select: { name: true } },
              _count: { select: { modules: true } },
            },
          },
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
        approvedAt: e.approvedAt?.toISOString() ?? null,
        cohort: {
          name: e.cohort.name,
          startDate: e.cohort.startDate.toISOString(),
          endDate: e.cohort.endDate.toISOString(),
        },
        course: {
          title: e.cohort.course.title,
          slug: e.cohort.course.slug,
          instructor: { name: e.cohort.course.instructor.name },
          moduleCount: e.cohort.course._count.modules,
        },
      }))}
      role={role}
      tabs={TABS}
    />
  );
}
