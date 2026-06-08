"use client";

// /admin/enrollments — staff-initiated enrollment tool, with a
// modal-driven "New enrollment" form. MANAGER + ADMIN.

import { useMemo, useState } from "react";
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

type Student = { id: string; name: string | null; email: string };
type Course = { id: string; title: string; slug: string; isPublished: boolean };
type Cohort = { id: string; name: string; startDate: string };
type RecentEnrollment = {
  id: string;
  user: { id: string; name: string | null; email: string };
  course: { id: string; title: string; slug: string };
  cohort: { id: string; name: string } | null;
  status: "ACTIVE" | "COMPLETED" | "DROPPED" | "SUSPENDED";
  enrolledAt: string;
};

type Props = {
  students: Student[];
  courses: Course[];
  cohorts: Cohort[];
  recent: RecentEnrollment[];
  role: "MANAGER" | "ADMIN";
};

const STATUS_TONE = {
  ACTIVE: "info",
  COMPLETED: "success",
  DROPPED: "neutral",
  SUSPENDED: "danger",
} as const;

export default function EnrollmentsClient({ students, courses, cohorts, recent, role }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((e) => {
      return (
        (e.user.name ?? "").toLowerCase().includes(q) ||
        e.user.email.toLowerCase().includes(q) ||
        e.course.title.toLowerCase().includes(q) ||
        (e.cohort?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [recent, query]);

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
            disabled={students.length === 0 || courses.length === 0}
          >
            <Icon.Plus className="h-4 w-4" />
            New enrollment
          </Button>
        }
      />

      <PageHeader
        eyebrow="Manage · Enrollments"
        title="Enrollments"
        description="Enroll a student in a course. Optionally tag with a cohort."
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
              ? "No students have registered yet. Once a student signs up, you can enroll them in a course here."
              : courses.length === 0
                ? "No courses in the catalog yet. Create one first."
                : "Click 'New enrollment' to enroll a student in a course."
          }
          action={
            students.length > 0 && courses.length > 0
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
                  <th className="py-2 font-medium">Enrolled</th>
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
                        {e.cohort ? e.cohort.name : <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[e.status]}>{e.status.toLowerCase()}</Badge>
                      </td>
                      <td className="py-3 text-xs text-ink-muted">
                        {new Date(e.enrolledAt).toLocaleDateString()}
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
        description="Pick a student, a course, and an optional cohort. The action is idempotent."
        widthClass="max-w-xl"
      >
        <EnrollStudentForm
          students={students}
          courses={courses}
          cohorts={cohorts.map((c) => ({ ...c, startDate: new Date(c.startDate) }))}
          onDone={() => {
            setCreateOpen(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
