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
import { CourseFormFields, type CourseFormData } from "./CourseForm";
import { deleteCourse } from "../catalog/actions";

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
};

type Props = {
  initialCourses: Course[];
  instructors: Person[];
  managers: Person[];
  role: "MANAGER" | "ADMIN";
};

export default function CoursesAdminClient({ initialCourses, instructors, managers, role }: Props) {
  const router = useRouter();
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
              onAfterDelete={() => router.refresh()}
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
  onAfterDelete,
}: {
  course: Course;
  onEdit: () => void;
  onAfterDelete: () => void;
}) {
  const router = useRouter();
  const tone = course.isPublished ? "success" : "neutral";

  return (
    <Card className="card-hover relative flex h-full flex-col overflow-hidden">
      <div className="-mx-6 -mt-6 mb-3 h-20 bg-gradient-to-br from-brand-100 via-brand-50 to-accent-50 dark:from-brand-500/15 dark:via-brand-500/5 dark:to-accent-500/10" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-ink">{course.title}</h3>
          <p className="truncate text-xs text-ink-muted">/{course.slug}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={tone}>{course.isPublished ? "published" : "draft"}</Badge>
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
              { kind: "separator" },
              {
                label: "Delete",
                icon: <Icon.Trash className="h-4 w-4" />,
                danger: true,
                disabled: course.enrollmentCount > 0,
                onClick: async () => {
                  if (!confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
                  const fd = new FormData();
                  fd.set("id", course.id);
                  const res = await deleteCourse(fd);
                  if (!res.ok) {
                    alert(res.error);
                    return;
                  }
                  onAfterDelete();
                  router.refresh();
                },
              },
            ]}
          />
        </div>
      </div>

      {course.description && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{course.description}</p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-line bg-surface-muted px-2.5 py-1.5">
          <dt className="text-ink-muted">Instructor</dt>
          <dd className="truncate font-medium text-ink">
            {course.instructor.name ?? course.instructor.email}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-surface-muted px-2.5 py-1.5">
          <dt className="text-ink-muted">Manager</dt>
          <dd className="truncate font-medium text-ink">
            {course.manager ? course.manager.name ?? course.manager.email : "— Unassigned —"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Icon.Layers className="h-4 w-4" />
            {course.moduleCount} {course.moduleCount === 1 ? "module" : "modules"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon.Group className="h-4 w-4" />
            {course.enrollmentCount}
          </span>
        </div>
        <Link
          href={`/admin/courses/${course.slug}`}
          className="font-semibold text-brand-500 hover:text-brand-600"
        >
          Modules →
        </Link>
      </div>
    </Card>
  );
}
