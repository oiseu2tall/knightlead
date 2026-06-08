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
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, slug: true } },
        cohort: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <EnrollmentsClient
      students={students}
      courses={courses}
      cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, startDate: c.startDate.toISOString() }))}
      recent={recent.map((e) => ({
        id: e.id,
        user: e.user,
        course: e.course,
        cohort: e.cohort,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
      }))}
      role={session.user.role === "ADMIN" ? "ADMIN" : "MANAGER"}
    />
  );
}
