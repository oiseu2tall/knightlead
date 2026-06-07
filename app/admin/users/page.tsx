// /admin/users — paginated, searchable, role-filterable user table.
// ADMIN-only: role changes are a privileged operation, so MANAGERs
// are bounced here too.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, PageHeader, Badge, RoleBadge } from "@/components/ui/Primitives";
import { RoleSelect } from "./RoleSelect";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Users · Admin" };

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  // Re-check: this subroute is ADMIN-only.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/forbidden");

  const { q, role, page } = await searchParams; // Next 16: Promise
  const where: Prisma.UserWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name:  { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      role && ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"].includes(role)
        ? { role: role as "STUDENT" | "INSTRUCTOR" | "MANAGER" | "ADMIN" }
        : {},
    ],
  };

  const pageNum = Math.max(1, Number(page ?? 1) || 1);

  const [users, total, counts] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { enrollments: true, submissions: true } },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const totalsByRole = Object.fromEntries(counts.map((c) => [c.role, c._count._all]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Administer · Users"
        title="Users"
        description={`${total} ${total === 1 ? "user" : "users"}`}
        accent="brand"
      />

      {/* Role summary chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <RoleChip label="All"        count={Object.values(totalsByRole).reduce((a, b) => a + b, 0)} href="/admin/users" active={!role} />
        <RoleChip label="Students"   count={totalsByRole.STUDENT ?? 0}   href="/admin/users?role=STUDENT"   active={role === "STUDENT"} />
        <RoleChip label="Instructors" count={totalsByRole.INSTRUCTOR ?? 0} href="/admin/users?role=INSTRUCTOR" active={role === "INSTRUCTOR"} />
        <RoleChip label="Managers"   count={totalsByRole.MANAGER ?? 0}   href="/admin/users?role=MANAGER"   active={role === "MANAGER"} />
        <RoleChip label="Admins"     count={totalsByRole.ADMIN ?? 0}     href="/admin/users?role=ADMIN"     active={role === "ADMIN"} />
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-center gap-2" action="/admin/users">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email…"
            className="block w-full flex-1 min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {role && <input type="hidden" name="role" value={role} />}
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Search
          </button>
        </form>
      </Card>

      <Card>
        {users.length === 0 ? (
          <p className="text-sm text-ink-muted">No users match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Verified</th>
                  <th className="py-2 pr-4 font-medium">Activity</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className="text-ink">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                          {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="block truncate font-medium text-ink hover:text-brand-600"
                          >
                            {u.name ?? "—"}
                          </Link>
                          <p className="truncate text-xs text-ink-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="mb-1.5">
                        <RoleBadge role={u.role} size="sm" />
                      </div>
                      <RoleSelect userId={u.id} currentRole={u.role} />
                    </td>
                    <td className="py-3 pr-4">
                      {u.emailVerified ? (
                        <Badge tone="success">verified</Badge>
                      ) : (
                        <Badge tone="warning">pending</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">
                      {u._count.enrollments} courses · {u._count.submissions} subs
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">
                      {u.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
            <span>Page {pageNum} of {totalPages}</span>
            <div className="flex gap-1">
              {pageNum > 1 && (
                <a
                  href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(pageNum - 1) })}`}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-dim"
                >
                  ← Prev
                </a>
              )}
              {pageNum < totalPages && (
                <a
                  href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(pageNum + 1) })}`}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-dim"
                >
                  Next →
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function RoleChip({ label, count, href, active }: { label: string; count: number; href: string; active: boolean }) {
  return (
    <a
      href={href}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
          : "border-line bg-surface text-ink-muted hover:bg-surface-dim",
      ].join(" ")}
    >
      {label}
      <span className="rounded-full bg-surface-dim px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
        {count}
      </span>
    </a>
  );
}
