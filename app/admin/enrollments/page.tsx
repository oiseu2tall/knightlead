// /admin/enrollments — server wrapper.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import EnrollmentsClient from "./EnrollmentsClient";

export const metadata = { title: "Enrollments · Catalog" };

export default async function EnrollmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [students, cohorts, recent] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    // Cohorts are the unit of enrollment, so the form lists them grouped by
    // their course, with seat counts to show which intakes are available.
    db.cohort.findMany({
      orderBy: [{ course: { title: "asc" } }, { startDate: "desc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        isOpen: true,
        capacity: true,
        course: { select: { id: true, title: true, slug: true, isPublished: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    // Include PENDING self-enrollments so managers/admins can
    // approve them. Staff-enrolled students are created ACTIVE by
    // default; only self-enrollments land in PENDING.
    db.enrollment.findMany({
      where: { status: { in: ["PENDING", "ACTIVE", "COMPLETED", "DROPPED", "SUSPENDED"] } },
      orderBy: { enrolledAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        // Read the course off the cohort — that is the authoritative link.
        // The denormalized courseId is kept in sync by the actions.
        cohort: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, title: true, slug: true } },
          },
        },
        // Who approved the seat, and when. Null for staff-created seats
        // that predate approval tracking.
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <EnrollmentsClient
      students={students}
      cohorts={cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        startDate: c.startDate.toISOString(),
        isOpen: c.isOpen,
        capacity: c.capacity,
        enrolledCount: c._count.enrollments,
        course: c.course,
      }))}
      recent={recent.map((e) => ({
        id: e.id,
        user: e.user,
        course: e.cohort.course,
        cohort: { id: e.cohort.id, name: e.cohort.name },
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        approvedAt: e.approvedAt?.toISOString() ?? null,
        approvedBy: e.approvedBy,
      }))}
      role={session.user.role === "ADMIN" ? "ADMIN" : "MANAGER"}
    />
  );
}
