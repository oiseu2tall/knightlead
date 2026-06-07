// Admin dashboard — "Administer" workspace.
// Top-level view across all roles: total users (by role), catalog
// counts, recent admin actions, and quick access into user management.
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard, Badge } from "@/components/ui/Primitives";
import { ROLE_META, isRole } from "@/lib/role";

export default async function AdminDashboard({ name }: { name: string }) {
  const [cohortCount, courseCount, moduleCount, roleCounts, recentAudit] = await Promise.all([
    db.cohort.count(),
    db.course.count(),
    db.module.count(),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.auditLog.findMany({
      where: { action: { in: ["CHANGE_USER_ROLE", "STAFF_ENROLL_STUDENT", "GRADE_SUBMISSION"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const countsByRole: Record<string, number> = Object.fromEntries(
    roleCounts.map((c) => [c.role, c._count._all]),
  );
  const totalUsers = roleCounts.reduce((n, c) => n + c._count._all, 0);
  const unverified = await db.user.count({ where: { emailVerified: null } });

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.ADMIN.plural} workspace</>}
        title={`Hi ${name.split(" ")[0] ?? "admin"} 👋`}
        description="Full access: catalog, enrollments, and user management."
        action={
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg bg-hero px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] hover:opacity-95"
          >
            Manage users →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={totalUsers} tone="brand" />
        <StatCard label="Unverified" value={unverified} tone={unverified > 0 ? "accent" : "brand"} />
        <StatCard label="Courses" value={courseCount} tone="accent" />
        <StatCard label="Cohorts" value={cohortCount} tone="brand" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Users by role</h2>
          <ul className="space-y-2.5">
            {(["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"] as const).map((r) => (
              <li key={r} className="flex items-center justify-between">
                <span className="text-sm text-ink">{ROLE_META[r].label}</span>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {countsByRole[r] ?? 0}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/users"
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-dim"
          >
            Open user management →
          </Link>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent admin activity</h2>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-ink-muted">No admin actions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentAudit.map((a) => {
                const tone =
                  a.action === "CHANGE_USER_ROLE" ? "accent" :
                  a.action === "STAFF_ENROLL_STUDENT" ? "info" :
                  a.action === "GRADE_SUBMISSION" ? "success" : "neutral";
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Badge tone={tone as "accent" | "info" | "success" | "neutral"}>
                      {a.action.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {a.user?.name ?? a.user?.email ?? "system"}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">{a.resource}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-muted">
                      {a.createdAt.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin" className="rounded-2xl border border-line bg-surface p-5 hover:bg-surface-dim">
          <h3 className="text-sm font-semibold text-ink">Catalog</h3>
          <p className="mt-1 text-xs text-ink-muted">Cohorts, courses, modules, enrollments.</p>
        </Link>
        <Link href="/admin/cohorts" className="rounded-2xl border border-line bg-surface p-5 hover:bg-surface-dim">
          <h3 className="text-sm font-semibold text-ink">Cohorts</h3>
          <p className="mt-1 text-xs text-ink-muted">{cohortCount} in catalog.</p>
        </Link>
        <Link href="/admin/courses" className="rounded-2xl border border-line bg-surface p-5 hover:bg-surface-dim">
          <h3 className="text-sm font-semibold text-ink">Courses</h3>
          <p className="mt-1 text-xs text-ink-muted">{moduleCount} modules total.</p>
        </Link>
        <Link href="/admin/users" className="rounded-2xl border border-line bg-surface p-5 hover:bg-surface-dim">
          <h3 className="text-sm font-semibold text-ink">Users</h3>
          <p className="mt-1 text-xs text-ink-muted">Search, filter, change roles.</p>
        </Link>
      </div>
    </>
  );
}

