// /admin — entry point for catalog managers and admins. Quick links
// into the catalog tools. MANAGER + ADMIN.
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card, PageHeader, StatCard } from "@/components/ui/Primitives";
import { db } from "@/lib/db";
import { ROLE_META, isRole } from "@/lib/role";

export const metadata = { title: "Catalog · Admin" };

export default async function AdminHome() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const [cohortCount, courseCount, moduleCount, userCount] = await Promise.all([
    db.cohort.count(),
    db.course.count(),
    db.module.count(),
    db.user.count(),
  ]);

  const role = isRole(session.user.role) ? session.user.role : "MANAGER";
  const section = role === "ADMIN" ? "Administer · Catalog" : "Manage · Catalog";

  return (
    <>
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
          title="Enrollments"
          description="Enroll a student in a course, optionally tagged with a cohort."
          cta="Enroll a student"
        />
        <AdminLinkCard
          href="/admin/cohorts"
          title="Cohorts"
          description="Create and edit cohorts; assign a manager."
          cta="Manage cohorts"
        />
        <AdminLinkCard
          href="/admin/courses"
          title="Courses"
          description="Create, publish, and assign courses to instructors."
          cta="Manage courses"
        />
        {session.user.role === "ADMIN" && (
          <AdminLinkCard
            href="/admin/users"
            title="Users"
            description="Search, filter, and change roles. Admin only."
            cta="Manage users"
          />
        )}
      </div>
    </>
  );
}

function AdminLinkCard({ href, title, description, cta }: { href: string; title: string; description: string; cta: string }) {
  return (
    <Link href={href} className="block focus:outline-none">
      <Card className="card-hover h-full">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
        <p className="mt-3 text-xs font-semibold text-brand-500">{cta} →</p>
      </Card>
    </Link>
  );
}
