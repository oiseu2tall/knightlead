// Manager dashboard — "Manage" workspace.
// Catalog health: cohorts, courses, modules, draft/published split,
// recent enrollments, recent catalog changes.
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, StatCard, Badge } from "@/components/ui/Primitives";
import { ROLE_META } from "@/lib/role";

export default async function ManagerDashboard({ name }: { name: string }) {
  const [cohortCount, courseCount, moduleCount, draftCount, publishedCount, recentEnrollments, recentEdits] = await Promise.all([
    db.cohort.count(),
    db.course.count(),
    db.module.count(),
    db.course.count({ where: { isPublished: false } }),
    db.course.count({ where: { isPublished: true } }),
    db.enrollment.findMany({
      orderBy: { enrolledAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
        cohort: { select: { name: true } },
      },
    }),
    db.auditLog.findMany({
      where: { action: { in: ["CREATE_COHORT", "UPDATE_COHORT", "CREATE_COURSE", "UPDATE_COURSE", "CREATE_MODULE", "UPDATE_MODULE", "STAFF_ENROLL_STUDENT"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={<>{ROLE_META.MANAGER.plural} workspace</>}
        title={`Hi ${name.split(" ")[0] ?? "manager"} 👋`}
        description="Catalog health and the latest activity."
        action={
          <Link
            href="/admin/enrollments"
            className="inline-flex items-center gap-1.5 rounded-lg bg-hero px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] hover:opacity-95"
          >
            Enroll a student →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Cohorts" value={cohortCount} tone="brand" />
        <StatCard label="Courses" value={courseCount} tone="accent" />
        <StatCard label="Modules" value={moduleCount} tone="brand" />
        <StatCard
          label="Drafts / Published"
          value={
            <span className="text-base">
              {draftCount} <span className="text-ink-muted">/</span> {publishedCount}
            </span>
          }
          tone="accent"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          href="/admin/cohorts"
          title="Manage cohorts"
          description="Create and edit cohorts. Assign a manager to track ownership."
          cta="Open cohorts"
        />
        <QuickCard
          href="/admin/courses"
          title="Manage courses"
          description="Create, publish, and assign courses to instructors."
          cta="Open courses"
        />
        <QuickCard
          href="/admin/enrollments"
          title="Enrollments"
          description="Assign students to courses and cohorts. Staff cannot be enrolled."
          cta="Open enrollments"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent enrollments</h2>
            <Link href="/admin/enrollments" className="text-xs font-medium text-brand-500 hover:text-brand-600">
              All
            </Link>
          </div>
          {recentEnrollments.length === 0 ? (
            <p className="text-sm text-ink-muted">No enrollments yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentEnrollments.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{e.user.name ?? e.user.email}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {e.course.title}{e.cohort ? ` · ${e.cohort.name}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-ink-muted">{e.enrolledAt.toLocaleDateString()}</span>
                  <Badge tone={e.status === "ACTIVE" ? "info" : e.status === "COMPLETED" ? "success" : "neutral"}>
                    {e.status.toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent catalog activity</h2>
            <p className="text-xs text-ink-muted">last {recentEdits.length}</p>
          </div>
          {recentEdits.length === 0 ? (
            <p className="text-sm text-ink-muted">No catalog activity yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentEdits.map((a) => (
                <li key={a.id} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
                  <Badge tone="accent" className="shrink-0">{a.action.replace(/_/g, " ").toLowerCase()}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink">
                      {a.user?.name ?? a.user?.email ?? "system"}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">{a.resource}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-muted">{a.createdAt.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function QuickCard({
  href,
  title,
  description,
  cta,
}: { href: string; title: string; description: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group block focus:outline-none"
    >
      <Card className="card-hover h-full">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
        <p className="mt-3 text-xs font-semibold text-brand-500">{cta} →</p>
      </Card>
    </Link>
  );
}
