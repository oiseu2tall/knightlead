// /admin/cohorts — server wrapper. Loads the catalog data, runs the
// role gate, and hands the serialized payload to the client view.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CohortsAdminClient, { type Cohort } from "./CohortsAdminClient";

export const metadata = { title: "Cohorts · Catalog" };

export default async function CohortsAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [cohorts, managers, courses] = await Promise.all([
    db.cohort.findMany({
      orderBy: [{ course: { title: "asc" } }, { startDate: "desc" }],
      include: {
        // A cohort is an intake of one course — the list has to say which.
        course: { select: { id: true, title: true, slug: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    db.course.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, slug: true },
    }),
  ]);

  const now = Date.now();
  const initialCohorts: Cohort[] = cohorts.map((c) => {
    const startMs = c.startDate.getTime();
    const endMs = c.endDate.getTime();
    const status: Cohort["status"] =
      startMs > now ? "upcoming" : endMs < now ? "ended" : "active";
    return {
      id: c.id,
      courseId: c.courseId,
      course: c.course,
      name: c.name,
      slug: c.slug,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      description: c.description,
      managerId: c.managerId,
      manager: c.manager,
      capacity: c.capacity,
      isOpen: c.isOpen,
      enrollmentCount: c._count.enrollments,
      status,
    };
  });

  const role = session.user.role === "ADMIN" ? "ADMIN" : "MANAGER";

  return (
    <CohortsAdminClient
      initialCohorts={initialCohorts}
      courses={courses}
      managers={managers}
      role={role}
    />
  );
}
