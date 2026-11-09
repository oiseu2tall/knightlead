"use client";

// /admin/courses — list + create/edit for courses. MANAGER + ADMIN.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CourseFormFields, DeleteCourseButton, type CourseFormData } from "./CourseForm";

type Person = { id: string; name: string | null; email: string; role: string };
export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  instructorId: string;
  instructor: { id: string; name: string | null; email: string };
  managerId: string | null;
  manager: { id: string; name: string | null; email: string } | null;
  isPublished: boolean;
  moduleCount: number;
  enrollmentCount: number;
  cohortCount: number;
};

type Props = {
  initialCourses: Course[];
  instructors: Person[];
  managers: Person[];
  role: "MANAGER" | "ADMIN";
};

export default function CoursesAdminClient({ initialCourses, instructors, managers, role }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialCourses.filter((c) => {
      if (statusFilter === "published" && !c.isPublished) return false;
      if (statusFilter === "draft" && c.isPublished) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.instructor.name ?? "").toLowerCase().includes(q) ||
        c.instructor.email.toLowerCase().includes(q)
      );
    });
  }, [initialCourses, query, statusFilter]);

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
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)} className="ml-2">
            <Icon.Plus className="h-4 w-4" />
            New course
          </Button>
        }
      />

      <PageHeader
        eyebrow="Manage · Courses"
        title="Courses"
        description={`${initialCourses.length} ${initialCourses.length === 1 ? "course" : "courses"} in the catalog`}
        accent="brand"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search courses…"
          aria-label="Search courses"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "published", "draft"] as const).map((s) => {
            const count =
              s === "all"
                ? initialCourses.length
                : initialCourses.filter((c) => (s === "published" ? c.isPublished : !c.isPublished)).length;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                    : "border-line bg-surface text-ink-muted hover:bg-surface-dim",
                ].join(" ")}
              >
                {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
                <span className="rounded-full bg-surface-dim px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="School"
          title={query || statusFilter !== "all" ? "No courses match your filters" : "No courses yet"}
          description={
            query || statusFilter !== "all"
              ? "Try clearing the search or status filter."
              : "Create your first course and assign an instructor to begin."
          }
          action={
            !query && statusFilter === "all"
              ? { label: "New course", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="kl-virtualize grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onEdit={() => setEditing(c)}
            />
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New course"
        description="Create a course, assign an instructor, and choose whether to publish immediately."
        widthClass="max-w-2xl"
      >
        <CourseFormFields
          instructors={instructors}
          managers={managers}
          onDone={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit course"
        description={editing?.title}
        widthClass="max-w-2xl"
      >
        {editing && (
          <CourseFormFields
            instructors={instructors}
            managers={managers}
            initial={courseToFormData(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function courseToFormData(c: Course): CourseFormData {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    thumbnailUrl: c.thumbnailUrl,
    instructorId: c.instructorId,
    managerId: c.managerId,
    isPublished: c.isPublished,
  };
}

function CourseCard({
  course,
  onEdit,
}: {
  course: Course;
  onEdit: () => void;
}) {
  const router = useRouter();
  const tone = course.isPublished ? "success" : "neutral";

  return (
    <Card className="card-hover relative flex h-full flex-col overflow-hidden p-0">
      <div className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-50 via-white to-accent-50 px-5 pb-4 pt-5 dark:from-brand-500/15 dark:via-surface dark:to-accent-500/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-white/30 dark:border-white/5"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-brand-600 shadow-sm dark:border-line dark:bg-surface/80 dark:text-brand-300">
            <Icon.School className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1">
            <Badge tone={tone}>{course.isPublished ? "Published" : "Draft"}</Badge>
            <DropdownMenu
              ariaLabel={`Actions for ${course.title}`}
              items={[
                {
                  label: "Edit details",
                  icon: <Icon.Edit className="h-4 w-4" />,
                  onClick: onEdit,
                },
                {
                  label: "Manage modules",
                  icon: <Icon.Layers className="h-4 w-4" />,
                  onClick: () => router.push(`/admin/courses/${course.slug}`),
                },
              ]}
            />
          </div>
        </div>
        <div className="relative mt-5 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
            Course
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-14 text-lg font-bold leading-7 tracking-tight text-ink">
            {course.title}
          </h3>
          <p className="mt-2 inline-flex max-w-full items-center rounded-md border border-line/80 bg-white/70 px-2 py-1 font-mono text-[11px] text-ink-muted dark:bg-surface/70">
            <span className="truncate">/{course.slug}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-ink-muted">
          {course.description || "No course description added yet."}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-line bg-surface-muted/70 px-3 py-2.5 dark:bg-surface-dim/60">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Instructor</dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              {course.instructor.name ?? course.instructor.email}
            </dd>
          </div>
          <div className="min-w-0 rounded-xl border border-line bg-surface-muted/70 px-3 py-2.5 dark:bg-surface-dim/60">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Manager</dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              {course.manager ? course.manager.name ?? course.manager.email : "Unassigned"}
            </dd>
          </div>
        </dl>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface-muted/50 py-2.5 dark:bg-surface-dim/40">
          <div className="px-2 text-center">
            <dd className="text-base font-bold tabular-nums text-ink">{course.moduleCount}</dd>
            <dt className="mt-0.5 text-[10px] font-medium text-ink-muted">Modules</dt>
          </div>
          <div className="px-2 text-center">
            <dd className="text-base font-bold tabular-nums text-ink">{course.cohortCount}</dd>
            <dt className="mt-0.5 text-[10px] font-medium text-ink-muted">Cohorts</dt>
          </div>
          <div className="px-2 text-center">
            <dd className="text-base font-bold tabular-nums text-ink">{course.enrollmentCount}</dd>
            <dt className="mt-0.5 text-[10px] font-medium text-ink-muted">Seats</dt>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <DeleteCourseButton
            id={course.id}
            disabled={course.cohortCount > 0 || course.enrollmentCount > 0}
          />
          <Link
            href={`/admin/courses/${course.slug}`}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Manage course
            <Icon.ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
