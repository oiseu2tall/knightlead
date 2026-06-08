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

  const [cohorts, managers] = await Promise.all([
    db.cohort.findMany({
      orderBy: { startDate: "desc" },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
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
      name: c.name,
      slug: c.slug,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      description: c.description,
      managerId: c.managerId,
      manager: c.manager,
      enrollmentCount: c._count.enrollments,
      status,
    };
  });

  const role = session.user.role === "ADMIN" ? "ADMIN" : "MANAGER";

  return (
    <CohortsAdminClient
      initialCohorts={initialCohorts}
      managers={managers}
      role={role}
    />
  );
}
