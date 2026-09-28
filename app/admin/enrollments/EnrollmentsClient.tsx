"use client";

// /admin/enrollments — staff-initiated enrollment tool, with a
// modal-driven "New enrollment" form. MANAGER + ADMIN.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { LongList } from "@/components/ui/LongList";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import { EnrollStudentForm } from "./EnrollStudentForm";
import { MoveEnrollmentDialog } from "./MoveEnrollmentDialog";
import { approveEnrollment, rejectEnrollment } from "../catalog/actions";

type Student = { id: string; name: string | null; email: string };
type Course = { id: string; title: string; slug: string };
type Cohort = {
  id: string;
  name: string;
  startDate: string;
  isOpen: boolean;
  capacity: number | null;
  enrolledCount: number;
  course: Course & { isPublished: boolean };
};
type RecentEnrollment = {
  id: string;
  user: { id: string; name: string | null; email: string };
  /** Resolved through the cohort — the authoritative course link. */
  course: Course;
  cohort: { id: string; name: string };
  status: "ACTIVE" | "COMPLETED" | "DROPPED" | "SUSPENDED" | "PENDING";
  enrolledAt: string;
  approvedAt: string | null;
  approvedBy: { id: string; name: string | null; email: string } | null;
};

type Props = {
  students: Student[];
  cohorts: Cohort[];
  recent: RecentEnrollment[];
  role: "MANAGER" | "ADMIN";
};

const STATUS_TONE = {
  PENDING: "warning",
  ACTIVE: "info",
  COMPLETED: "success",
  DROPPED: "neutral",
  SUSPENDED: "danger",
} as const;

export default function EnrollmentsClient({ students, cohorts, recent, role }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [moving, setMoving] = useState<RecentEnrollment | null>(null);
  const [, startTransition] = useTransition();

  const pendingCount = recent.filter((e) => e.status === "PENDING").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((e) => {
      return (
        (e.user.name ?? "").toLowerCase().includes(q) ||
        e.user.email.toLowerCase().includes(q) ||
        e.course.title.toLowerCase().includes(q) ||
        e.cohort.name.toLowerCase().includes(q)
      );
    });
  }, [recent, query]);

  async function runApproval(e: RecentEnrollment, action: "approve" | "reject") {
    if (
      action === "reject" &&
      !confirm(`Decline ${e.user.email}'s request for ${e.cohort.name}?`)
    ) {
      return;
    }
    const key = `${e.id}:${action}`;
    setBusyAction(key);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("enrollmentId", e.id);
      const res =
        action === "approve" ? await approveEnrollment(fd) : await rejectEnrollment(fd);
      setBusyAction(null);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
    });
  }

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
      <SubNav
        items={subNavItems}
        trailing={
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="ml-2"
            disabled={students.length === 0 || cohorts.length === 0}
          >
            <Icon.Plus className="h-4 w-4" />
            New enrollment
          </Button>
        }
      />

      <PageHeader
        eyebrow="Manage · Enrollments"
        title="Enrollments"
        description={
          pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "enrollment" : "enrollments"} pending approval`
            : "Every seat belongs to a cohort. The course follows from the cohort."
        }
        accent="brand"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search by student, course, or cohort…"
          aria-label="Search enrollments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <span className="text-xs text-ink-muted">
          {filtered.length} of {recent.length}
        </span>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          icon="Assignment"
          title="No enrollments yet"
          description={
            students.length === 0
              ? "No students have registered yet. Once a student signs up, you can place them in a cohort here."
              : cohorts.length === 0
                ? "No cohorts exist yet. A seat always belongs to a cohort, so create one for a course first."
                : "Click 'New enrollment' to place a student in a cohort."
          }
          action={
            students.length > 0 && cohorts.length > 0
              ? { label: "New enrollment", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Course</th>
                  <th className="py-2 pr-4 font-medium">Cohort</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Enrolled</th>
                  <th className="py-2 pr-4 font-medium">Approved</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <LongList
                  items={filtered}
                  pageSize={25}
                  stepSize={25}
                  virtualizeClass="contents"
                  getKey={(e) => e.id}
                  renderItem={(e) => (
                    <tr className="text-ink">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                            {(e.user.name?.[0] ?? e.user.email[0]).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/users/${e.user.id}`}
                              className="block truncate font-medium text-ink hover:text-brand-600"
                            >
                              {e.user.name ?? e.user.email}
                            </Link>
                            <p className="truncate text-[11px] text-ink-muted">{e.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/courses/${e.course.slug}`}
                          className="font-medium text-ink hover:text-brand-600"
                        >
                          {e.course.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-muted">
                        {e.cohort.name}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[e.status]}>{e.status.toLowerCase()}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-muted">
                        {new Date(e.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-muted">
                        {e.approvedAt ? (
                          <>
                            <span className="block text-ink">
                              {new Date(e.approvedAt).toLocaleDateString()}
                            </span>
                            {e.approvedBy && (
                              <span className="block truncate">
                                by {e.approvedBy.name ?? e.approvedBy.email}
                              </span>
                            )}
                          </>
                        ) : (
                          <span title="Created directly by staff, or predates approval tracking.">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {e.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => void runApproval(e, "approve")}
                              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                              {busyAction === `${e.id}:approve` ? "Approving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => void runApproval(e, "reject")}
                              className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-surface-dim disabled:opacity-50"
                            >
                              {busyAction === `${e.id}:reject` ? "Declining…" : "Decline"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMoving(e)}
                              className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-surface-dim"
                            >
                              Move
                            </button>
                            <span className="text-xs text-ink-muted">—</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                />
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New enrollment"
        description="Pick a student and a cohort. The course comes from the cohort, and the seat is active immediately. The action is idempotent."
        widthClass="max-w-xl"
      >
        <EnrollStudentForm students={students} cohorts={cohorts} />
      </Modal>

      <Modal
        open={moving !== null}
        onClose={() => setMoving(null)}
        title="Move to another cohort"
        description={
          moving
            ? `${moving.user.name ?? moving.user.email} · currently in ${moving.cohort.name}`
            : undefined
        }
        widthClass="max-w-xl"
      >
        {moving && (
          <MoveEnrollmentDialog
            enrollment={moving}
            cohorts={cohorts.filter((c) => c.id !== moving.cohort.id)}
            onDone={() => {
              setMoving(null);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
