// /admin/users/[id] — drill-down view of a single user.
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, PageHeader, Badge, ProgressBar, RoleBadge } from "@/components/ui/Primitives";
import Link from "next/link";

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next 16: Promise
  const user = await db.user.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { course: { select: { title: true, slug: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      submissions: {
        include: { assignment: { select: { title: true, maxScore: true } } },
        orderBy: { submittedAt: "desc" },
        take: 10,
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Administer · Users"
        title={user.name ?? user.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <RoleBadge role={user.role} size="sm" />
          </span>
        }
        accent="brand"
        action={
          <Link
            href="/admin/users"
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            ← Back to users
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Account</h2>
          <dl className="space-y-2 text-sm">
            <Row label="ID" value={<span className="font-mono text-xs text-ink-muted">{user.id}</span>} />
            <Row label="Role" value={<RoleBadge role={user.role} />} />
            <Row
              label="Verified"
              value={user.emailVerified
                ? <Badge tone="success">verified</Badge>
                : <Badge tone="warning">pending</Badge>}
            />
            <Row label="Joined" value={user.createdAt.toLocaleString()} />
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Enrollments ({user.enrollments.length})</h2>
          {user.enrollments.length === 0 ? (
            <p className="text-sm text-ink-muted">None.</p>
          ) : (
            <ul className="space-y-3">
              {user.enrollments.map((e) => (
                <li key={e.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/dashboard/courses/${e.course.slug}`}
                      className="truncate font-medium text-ink hover:text-brand-600"
                    >
                      {e.course.title}
                    </Link>
                    <span className="text-xs tabular-nums text-ink-muted">{e.progress}%</span>
                  </div>
                  <ProgressBar value={e.progress} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent submissions</h2>
          {user.submissions.length === 0 ? (
            <p className="text-sm text-ink-muted">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {user.submissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-ink">{s.assignment.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {s.score != null ? `${s.score}/${s.assignment.maxScore}` : s.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-ink">Audit log</h2>
          {user.auditLogs.length === 0 ? (
            <p className="text-sm text-ink-muted">No entries for this user yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {user.auditLogs.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{a.action}</p>
                    {a.resource && <p className="truncate text-xs text-ink-muted">{a.resource}</p>}
                    {a.metadata && (
                      <pre className="mt-1 overflow-x-auto rounded bg-surface-dim px-2 py-1 text-[11px] text-ink-muted">
                        {JSON.stringify(a.metadata)}
                      </pre>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{a.createdAt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
