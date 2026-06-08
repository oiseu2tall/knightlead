"use client";

// /admin/cohorts — list + create/edit for cohorts.
// MANAGER + ADMIN.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CohortFormFields, type CohortFormData } from "./CohortForm";
import { deleteCohort } from "../catalog/actions";

type Manager = { id: string; name: string | null; email: string; role: string };
export type Cohort = {
  id: string;
  name: string;
  slug: string;
  startDate: string; // serialized for client component
  endDate: string;
  description: string | null;
  managerId: string | null;
  manager: { id: string; name: string | null; email: string } | null;
  enrollmentCount: number;
  status: "upcoming" | "active" | "ended";
};

type Props = {
  initialCohorts: Cohort[];
  managers: Manager[];
  role: "MANAGER" | "ADMIN";
};

export default function CohortsAdminClient({ initialCohorts, managers, role }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Cohort["status"]>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialCohorts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialCohorts, query, statusFilter]);

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
          >
            <Icon.Plus className="h-4 w-4" />
            New cohort
          </Button>
        }
      />

      <PageHeader
        eyebrow="Manage · Cohorts"
        title="Cohorts"
        description={`${initialCohorts.length} ${initialCohorts.length === 1 ? "cohort" : "cohorts"} in the catalog`}
        accent="brand"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search cohorts…"
          aria-label="Search cohorts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "active", "upcoming", "ended"] as const).map((s) => {
            const count =
              s === "all"
                ? initialCohorts.length
                : initialCohorts.filter((c) => c.status === s).length;
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
          icon="Group"
          title={query || statusFilter !== "all" ? "No cohorts match your filters" : "No cohorts yet"}
          description={
            query || statusFilter !== "all"
              ? "Try clearing the search or status filter."
              : "Create your first cohort to start grouping students by start date."
          }
          action={
            !query && statusFilter === "all"
              ? { label: "New cohort", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="kl-virtualize grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CohortCard
              key={c.id}
              cohort={c}
              onEdit={() => setEditing(c)}
              onAfterDelete={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && initialCohorts.some((c) => c.enrollmentCount > 0) && (
        <p className="mt-4 text-xs text-ink-muted">
          Cohorts with enrollments cannot be deleted. Move or unassign the enrollments first.
        </p>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New cohort"
        description="Group students by start and end date. Optional manager ownership."
        widthClass="max-w-xl"
      >
        <CohortFormFields managers={managers} onDone={() => setCreateOpen(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit cohort"
        description={editing?.name}
        widthClass="max-w-xl"
      >
        {editing && (
          <CohortFormFields
            managers={managers}
            initial={cohortToFormData(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function cohortToFormData(c: Cohort): CohortFormData {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    startDate: new Date(c.startDate),
    endDate: new Date(c.endDate),
    description: c.description,
    managerId: c.managerId,
  };
}

function CohortCard({
  cohort,
  onEdit,
  onAfterDelete,
}: {
  cohort: Cohort;
  onEdit: () => void;
  onAfterDelete: () => void;
}) {
  const router = useRouter();
  const tone =
    cohort.status === "active"
      ? "success"
      : cohort.status === "upcoming"
        ? "info"
        : "neutral";
  const start = new Date(cohort.startDate);
  const end = new Date(cohort.endDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <Card className="card-hover relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{cohort.name}</h3>
          <p className="truncate text-xs text-ink-muted">/{cohort.slug}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={tone}>{cohort.status}</Badge>
          <DropdownMenu
            ariaLabel={`Actions for ${cohort.name}`}
            items={[
              {
                label: "Edit",
                icon: <Icon.Edit className="h-4 w-4" />,
                onClick: onEdit,
              },
              { kind: "separator" },
              {
                label: "Delete",
                icon: <Icon.Trash className="h-4 w-4" />,
                danger: true,
                disabled: cohort.enrollmentCount > 0,
                onClick: async () => {
                  if (!confirm(`Delete "${cohort.name}"? This cannot be undone.`)) return;
                  const fd = new FormData();
                  fd.set("id", cohort.id);
                  const res = await deleteCohort(fd);
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

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div>
          <dt className="text-ink-muted">Start</dt>
          <dd className="font-medium text-ink">{fmt(start)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">End</dt>
          <dd className="font-medium text-ink">{fmt(end)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">Manager</dt>
          <dd className="truncate font-medium text-ink">
            {cohort.manager ? cohort.manager.name ?? cohort.manager.email : "— Unassigned —"}
          </dd>
        </div>
      </dl>

      {cohort.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{cohort.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon.Group className="h-4 w-4" />
          {cohort.enrollmentCount} {cohort.enrollmentCount === 1 ? "enrollment" : "enrollments"}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="font-semibold text-brand-500 hover:text-brand-600"
        >
          Edit →
        </button>
      </div>
    </Card>
  );
}
