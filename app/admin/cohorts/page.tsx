// /admin/cohorts — list + create/edit form for cohorts.
// MANAGER + ADMIN. The layout already gates role; this page just
// enforces the catalog-writer contract for the data it shows.
import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { CohortForm } from "./CohortForm";
import { CohortRow } from "./CohortRow";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

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

  return (
    <>
      <PageHeader
        eyebrow="Manage · Cohorts"
        title="Cohorts"
        description={`${cohorts.length} ${cohorts.length === 1 ? "cohort" : "cohorts"} in the catalog`}
        accent="brand"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          {cohorts.length === 0 ? (
            <p className="text-sm text-ink-muted">No cohorts yet. Create one on the right.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 font-medium">Manager</th>
                    <th className="py-2 pr-4 font-medium">Enrollments</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cohorts.map((c) => (
                    <CohortRow
                      key={c.id}
                      cohort={{
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        startDate: c.startDate,
                        endDate: c.endDate,
                        description: c.description,
                        managerId: c.managerId,
                        manager: c.manager,
                        enrollmentCount: c._count.enrollments,
                      }}
                      managers={managers}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div>
          <CohortForm mode="create" managers={managers} />
        </div>
      </div>

      {cohorts.length > 0 && (
        <p className="mt-4 text-xs text-ink-muted">
          Cohorts with enrollments cannot be deleted. Mark the cohort inactive
          or move its enrollments first.
        </p>
      )}
    </>
  );
}
