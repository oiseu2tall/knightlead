"use client";

// Self-enrollment is cohort-first: the student picks an *intake*, and the
// course comes from it. A course with no open cohorts shows why rather
// than an action that will fail.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { enrollInCohort, withdrawEnrollment } from "../actions";

export type CohortOption = {
  cohortId: string;
  cohortName: string;
  startDate: string;
  endDate: string;
  /** null = unlimited seats. */
  seatsLeft: number | null;
  isOpen: boolean;
  /** The student's current seat in this cohort, if any. */
  currentStatus: "PENDING" | "ACTIVE" | "COMPLETED" | "DROPPED" | "SUSPENDED" | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Dates to be confirmed";
  const sameYear = s.getFullYear() === e.getFullYear();
  const left = `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  const right = `${MONTHS[e.getMonth()]} ${e.getDate()}${sameYear ? "" : ` ${e.getFullYear()}`}`;
  return `${left} – ${right}, ${e.getFullYear()}`;
}

export function EnrollButton({ cohorts }: { cohorts: CohortOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  const chosen = cohorts.find((c) => c.cohortId === selected) ?? null;

  // The student may only act on a cohort they don't already hold a live or
  // pending seat in. A DROPPED seat is re-requestable.
  const actionable = chosen && chosen.currentStatus !== "PENDING" && chosen.currentStatus !== "ACTIVE" && chosen.currentStatus !== "COMPLETED";
  const withdrawable = chosen?.currentStatus === "PENDING";

  if (cohorts.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface-dim px-3 py-2 text-xs text-ink-muted">
        No intakes are open for this course right now. Check back soon or contact your
        coordinator.
      </p>
    );
  }

  function enroll() {
    if (!chosen) return;
    setError(null);
    const fd = new FormData();
    fd.set("cohortId", chosen.cohortId);
    startTransition(async () => {
      const res = await enrollInCohort(fd);
      if (!res.ok) { setError(res.error); return; }
      router.push("/dashboard/courses");
      router.refresh();
    });
  }

  function withdraw() {
    if (!chosen) return;
    setError(null);
    const fd = new FormData();
    fd.set("cohortId", chosen.cohortId);
    startTransition(async () => {
      const res = await withdrawEnrollment(fd);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Choose an intake
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setError(null); }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink focus:border-ink-muted focus:outline-none"
        >
          <option value="">Select a cohort…</option>
          {cohorts.map((c) => {
            // Several of these can be true at once — a student can hold a
            // pending request in an intake that has since closed — so
            // collect every applicable tag rather than short-circuiting.
            const seat = c.currentStatus;
            const full = c.seatsLeft !== null && c.seatsLeft <= 0;
            const tags: string[] = [];
            if (seat === "PENDING") tags.push("request pending");
            else if (seat === "ACTIVE") tags.push("enrolled");
            else if (seat === "COMPLETED") tags.push("completed");
            if (!c.isOpen) tags.push("closed to self-enrollment");
            if (full) tags.push("full");
            if (!tags.length && c.seatsLeft !== null) {
              tags.push(`${c.seatsLeft} seat${c.seatsLeft === 1 ? "" : "s"} left`);
            }
            return (
              <option key={c.cohortId} value={c.cohortId}>
                {c.cohortName} ({formatRange(c.startDate, c.endDate)})
                {tags.length ? ` — ${tags.join(", ")}` : ""}
              </option>
            );
          })}
        </select>
      </label>

      {chosen && (
        <p className="text-xs text-ink-muted">
          {chosen.currentStatus === "ACTIVE" || chosen.currentStatus === "COMPLETED"
            ? "You already hold a seat in this intake."
            : chosen.currentStatus === "PENDING"
              ? "Your request is waiting for approval."
              : !chosen.isOpen
                ? "This intake is not accepting self-enrollment."
                : chosen.seatsLeft === 0
                  ? "This intake is full."
                  : "Your request will be reviewed before you get access."}
        </p>
      )}

      {withdrawable ? (
        <Button type="button" loading={pending} onClick={withdraw}>
          Cancel request
        </Button>
      ) : (
        <Button
          type="button"
          variant="accent"
          loading={pending}
          disabled={!actionable}
          onClick={enroll}
        >
          Request a seat
        </Button>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
