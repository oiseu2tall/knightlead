"use client";

// Renders one cohort row, with an inline edit form and a delete button.
import { useState } from "react";
import { Badge } from "@/components/ui/Primitives";
import { CohortForm, DeleteCohortButton } from "./CohortForm";
import type { Role } from "@prisma/client";

type Manager = { id: string; name: string | null; email: string; role: string };

type Cohort = {
  id: string;
  name: string;
  slug: string;
  startDate: Date;
  endDate: Date;
  description: string | null;
  managerId: string | null;
  manager: { id: string; name: string | null; email: string } | null;
  enrollmentCount: number;
};

export function CohortRow({
  cohort,
  managers,
}: {
  cohort: Cohort;
  managers: Manager[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr className="text-ink align-top">
        <td className="py-3 pr-4">
          <p className="font-medium">{cohort.name}</p>
          <p className="text-xs text-ink-muted">/{cohort.slug}</p>
          {cohort.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{cohort.description}</p>
          )}
        </td>
        <td className="py-3 pr-4 text-xs text-ink-muted">
          <div>{cohort.startDate.toLocaleDateString()}</div>
          <div>→ {cohort.endDate.toLocaleDateString()}</div>
        </td>
        <td className="py-3 pr-4 text-xs text-ink-muted">
          {cohort.manager ? (
            <>
              <p className="font-medium text-ink">{cohort.manager.name ?? cohort.manager.email}</p>
              <p className="text-[11px]">{cohort.manager.email}</p>
            </>
          ) : (
            <span className="text-ink-muted">— Unassigned —</span>
          )}
        </td>
        <td className="py-3 pr-4">
          <Badge tone={cohort.enrollmentCount > 0 ? "info" : "neutral"}>
            {cohort.enrollmentCount}
          </Badge>
        </td>
        <td className="py-3">
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <DeleteCohortButton
              id={cohort.id}
              disabled={cohort.enrollmentCount > 0}
            />
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-surface-dim/40">
          <td colSpan={5} className="py-3 pr-4">
            <div className="ml-auto max-w-md">
              <CohortForm
                mode="edit"
                managers={managers}
                initial={{
                  id: cohort.id,
                  name: cohort.name,
                  slug: cohort.slug,
                  startDate: cohort.startDate,
                  endDate: cohort.endDate,
                  description: cohort.description,
                  managerId: cohort.managerId,
                }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
