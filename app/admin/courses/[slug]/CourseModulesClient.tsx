"use client";

// /admin/courses/[slug] — module list + add/edit for a single course.
// MANAGER + ADMIN.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { SubNav } from "@/components/layout/SubNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ModuleFormFields, DeleteModuleButton, type ModuleFormData } from "./ModuleForm";
import { deleteModule } from "../../catalog/actions";

export type ModuleRow = {
  id: string;
  title: string;
  order: number;
  fileKey: string | null;
  fileName: string | null;
  lessonCount: number;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  moduleCount: number;
  lessonCount: number;
  instructor: { name: string | null; email: string };
  manager: { name: string | null; email: string } | null;
};

type Props = {
  course: Course;
  initialModules: ModuleRow[];
  role: "MANAGER" | "ADMIN";
};

export default function CourseModulesClient({ course, initialModules, role }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleRow | null>(null);

  const nextOrder =
    initialModules.length === 0
      ? 1
      : (initialModules[initialModules.length - 1]?.order ?? 0) + 1;

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

      <Breadcrumb
        items={[
          { label: "Manage", href: "/admin" },
          { label: "Courses", href: "/admin/courses" },
          { label: course.title },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={course.isPublished ? "success" : "neutral"}>
              {course.isPublished ? "published" : "draft"}
            </Badge>
            <span className="text-xs text-ink-muted">
              {course.moduleCount} {course.moduleCount === 1 ? "module" : "modules"} ·{" "}
              {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{course.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Taught by{" "}
            <span className="font-medium text-ink">
              {course.instructor.name ?? course.instructor.email}
            </span>
            {course.manager && (
              <>
                {" · "}managed by{" "}
                <span className="font-medium text-ink">
                  {course.manager.name ?? course.manager.email}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            All courses
          </Link>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Icon.Plus className="h-4 w-4" />
            Add module
          </Button>
        </div>
      </div>

      {initialModules.length === 0 ? (
        <EmptyState
          icon="Layers"
          title="No modules yet"
          description="Modules are the top-level units of a course. Add the first one to start organizing lessons."
          action={{ label: "Add module", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <ol className="kl-virtualize space-y-3">
          {initialModules.map((m, idx) => (
            <li key={m.id}>
              <Card className="card-hover">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{m.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span>Order {m.order}</span>
                      <span>·</span>
                      <span>
                        {m.lessonCount} {m.lessonCount === 1 ? "lesson" : "lessons"}
                      </span>
                      {m.fileName && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Icon.File className="h-3.5 w-3.5" />
                            {m.fileName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu
                      ariaLabel={`Actions for module ${m.title}`}
                      items={[
                        {
                          label: "Edit",
                          icon: <Icon.Edit className="h-4 w-4" />,
                          onClick: () => setEditing(m),
                        },
                        { kind: "separator" },
                        {
                          label: "Delete",
                          icon: <Icon.Trash className="h-4 w-4" />,
                          danger: true,
                          onClick: async () => {
                            if (!confirm(`Delete module "${m.title}"? Lessons inside will also be removed.`)) return;
                            const fd = new FormData();
                            fd.set("id", m.id);
                            const res = await deleteModule(fd);
                            if (!res.ok) { alert(res.error); return; }
                            router.refresh();
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add module"
        description={`Order ${nextOrder} will be assigned. Existing modules at or after this order will be bumped down.`}
        widthClass="max-w-xl"
      >
        <ModuleFormFields
          courseId={course.id}
          nextOrder={nextOrder}
          onDone={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit module"
        description={editing?.title}
        widthClass="max-w-xl"
      >
        {editing && (
          <ModuleFormFields
            courseId={course.id}
            nextOrder={editing.order}
            initial={moduleToFormData(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function moduleToFormData(m: ModuleRow): ModuleFormData {
  return {
    id: m.id,
    title: m.title,
    order: m.order,
    fileKey: m.fileKey,
    fileName: m.fileName,
  };
}
