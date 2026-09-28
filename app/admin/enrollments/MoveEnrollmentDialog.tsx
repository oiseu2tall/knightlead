"use client";

// Move a student from one cohort to another. The seat follows the cohort,
// so this also switches the student to the destination cohort's course —
// the server action re-derives the course rather than trusting the form.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { moveEnrollmentToCohort } from "../catalog/actions";

type Cohort = {
  id: string;
  name: string;
  startDate: string;
  isOpen: boolean;
  capacity: number | null;
  enrolledCount: number;
  course: { id: string; title: string; slug: string; isPublished: boolean };
};

type Enrollment = {
  id: string;
  cohort: { id: string; name: string };
};

export function MoveEnrollmentDialog({
  enrollment,
  cohorts,
  onDone,
}: {
  enrollment: Enrollment;
  cohorts: Cohort[];
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState("");

  const chosen = cohorts.find((c) => c.id === cohortId) ?? null;

  function submit() {
    if (!chosen) return;
    setError(null);
    const fd = new FormData();
    fd.set("enrollmentId", enrollment.id);
    fd.set("cohortId", chosen.id);
    startTransition(async () => {
      const res = await moveEnrollmentToCohort(fd);
      if (!res.ok) { setError(res.error); return; }
      onDone?.();
    });
  }

  if (cohorts.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface-dim px-3 py-2 text-xs text-ink-muted">
        There are no other cohorts to move this seat into. Create another cohort for
        the course first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Destination cohort"
        name="cohortId"
        hint="Moving to a cohort of a different course also switches the student's course, because the seat belongs to the cohort."
      >
        <select
          name="cohortId"
          required
          value={cohortId}
          onChange={(e) => { setCohortId(e.target.value); setError(null); }}
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">— Select a cohort —</option>
          {cohorts.map((c) => {
            const full = c.capacity !== null && c.enrolledCount >= c.capacity;
            const seats =
              c.capacity === null
                ? `${c.enrolledCount} enrolled`
                : `${c.enrolledCount}/${c.capacity} seats`;
            return (
              <option key={c.id} value={c.id}>
                {c.course.title} — {c.name} ({seats}
                {full ? ", full" : ""})
              </option>
            );
          })}
        </select>
      </Field>

      {chosen && (
        <p className="text-xs text-ink-muted">
          Destination course: <span className="font-medium text-ink">{chosen.course.title}</span>
          {chosen.capacity !== null && chosen.enrolledCount >= chosen.capacity
            ? " — this cohort is full, so the move will be refused."
            : ""}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="primary" loading={pending} disabled={!chosen} onClick={submit}>
          Move seat
        </Button>
      </div>
    </div>
  );
}
