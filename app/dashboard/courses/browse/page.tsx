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

/** Seat-holding states, in the order that should win when a student has several. */
const STATUS_PRIORITY = ["COMPLETED", "ACTIVE", "PENDING", "SUSPENDED", "DROPPED"] as const;

export default async function BrowseCourses() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  const userId = session.user.id;

  const courses = await db.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    include: {
      instructor: { select: { name: true, email: true } },
      _count: { select: { modules: true, enrollments: true } },
      // Cohorts are the unit of enrollment, so the browse card has to show
      // them: a course with no open intake cannot be joined at all.
      cohorts: {
        orderBy: { startDate: "asc" },
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });

  // The viewer's own seats, resolved in one query across every course
  // rather than per-course inside the map.
  const mySeats = await db.enrollment.findMany({
    where: { userId },
    select: { courseId: true, cohortId: true, status: true },
  });
  const seatByCohort = new Map(mySeats.map((s) => [s.cohortId, s.status]));
  const statusesByCourse = new Map<string, Set<string>>();
  for (const s of mySeats) {
    let set = statusesByCourse.get(s.courseId);
    if (!set) statusesByCourse.set(s.courseId, (set = new Set()));
    set.add(s.status);
  }

  return (
    <BrowseClient
      canEnroll={role === "STUDENT"}
      isAdmin={role === "ADMIN"}
      tabs={TABS}
      courses={courses.map((c) => {
        // A student may hold several seats in one course, so the card
        // badge shows the strongest status among them.
        const mine = statusesByCourse.get(c.id);
        const enrolled =
          STATUS_PRIORITY.find((s) => mine?.has(s)) ??
          null;

        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          description: c.description,
          instructor: c.instructor,
          moduleCount: c._count.modules,
          enrollmentCount: c._count.enrollments,
          cohortCount: c.cohorts.length,
          openCohortCount: c.cohorts.filter(
            (co) =>
              co.isOpen &&
              (co.capacity === null || co._count.enrollments < co.capacity),
          ).length,
          enrolled,
          cohorts: c.cohorts.map((co) => ({
            cohortId: co.id,
            cohortName: co.name,
            startDate: co.startDate.toISOString(),
            endDate: co.endDate.toISOString(),
            seatsLeft:
              co.capacity === null ? null : Math.max(0, co.capacity - co._count.enrollments),
            isOpen: co.isOpen,
            currentStatus: seatByCohort.get(co.id) ?? null,
          })),
        };
      })}
    />
  );
}
