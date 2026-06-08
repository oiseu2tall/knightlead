// /admin — entry point for catalog managers and admins. Quick links
// into the catalog tools. MANAGER + ADMIN.
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card, PageHeader, StatCard } from "@/components/ui/Primitives";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import { db } from "@/lib/db";
import { ROLE_META, isRole } from "@/lib/role";

export const metadata = { title: "Catalog · Admin" };

export default async function AdminHome() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [cohortCount, courseCount, moduleCount, userCount, pendingEnrollCount] = await Promise.all([
    db.cohort.count(),
    db.course.count(),
    db.module.count(),
    db.user.count(),
    db.enrollment.count({ where: { status: "ACTIVE" } }),
  ]);

  const role = isRole(session.user.role) ? session.user.role : "MANAGER";
  const section = role === "ADMIN" ? "Administer · Catalog" : "Manage · Catalog";

  const subNavItems = [
    { href: "/admin", label: "Overview", icon: "Dashboard" as IconName, matchPrefix: false },
    { href: "/admin/cohorts", label: "Cohorts", icon: "Group" as IconName },
    { href: "/admin/courses", label: "Courses", icon: "School" as IconName },
    { href: "/admin/enrollments", label: "Enrollments", icon: "Assignment" as IconName },
    ...(role === "ADMIN"
      ? [{ href: "/admin/users", label: "Users", icon: "Settings" as IconName }]
      : []),
  ];

  return (
    <>
      <SubNav items={subNavItems} />

      <PageHeader
        eyebrow={<>{section} · {ROLE_META[role].label} workspace</>}
        title="Catalog"
        description={
          session.user.role === "ADMIN"
            ? "You have full access: user management, cohorts, courses, and modules."
            : "You can manage cohorts, courses, and modules."
        }
        accent="brand"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Cohorts" value={cohortCount} tone="brand" />
        <StatCard label="Courses" value={courseCount} tone="accent" />
        <StatCard label="Modules" value={moduleCount} tone="brand" />
        <StatCard label="Users" value={userCount} tone="accent" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminLinkCard
          href="/admin/enrollments"
          icon="Assignment"
          title="Enrollments"
          description="Enroll a student in a course, optionally tagged with a cohort."
          cta="Enroll a student"
          count={pendingEnrollCount}
          countLabel="active"
        />
        <AdminLinkCard
          href="/admin/cohorts"
          icon="Group"
          title="Cohorts"
          description="Create and edit cohorts; assign a manager."
          cta="Manage cohorts"
          count={cohortCount}
          countLabel="cohorts"
        />
        <AdminLinkCard
          href="/admin/courses"
          icon="School"
          title="Courses"
          description="Create, publish, and assign courses to instructors."
          cta="Manage courses"
          count={courseCount}
          countLabel="courses"
        />
        {session.user.role === "ADMIN" && (
          <AdminLinkCard
            href="/admin/users"
            icon="Settings"
            title="Users"
            description="Search, filter, and change roles. Admin only."
            cta="Manage users"
            count={userCount}
            countLabel="users"
          />
        )}
      </div>
    </>
  );
}

function AdminLinkCard({
  href,
  icon,
  title,
  description,
  cta,
  count,
  countLabel,
}: {
  href: string;
  icon: IconName;
  title: string;
  description: string;
  cta: string;
  count: number;
  countLabel: string;
}) {
  const I = Icon[icon];
  return (
    <Link href={href} className="block focus:outline-none">
      <Card className="card-hover relative h-full overflow-hidden">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-hero transition-transform duration-200 group-hover:scale-x-100"
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-200">
            <I className="h-5 w-5" />
          </div>
          <span className="rounded-full bg-surface-dim px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
            {count} {countLabel}
          </span>
        </div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
        <p className="mt-3 text-xs font-semibold text-brand-500">{cta} →</p>
      </Card>
    </Link>
  );
}
