"use client";

// Manage a cohort's curriculum: which lessons of its course this intake
// teaches, in what order, and when each one is released to students.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SubNav } from "@/components/layout/SubNav";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  addCohortLesson,
  clearCohortCurriculum,
  moveCohortLesson,
  removeCohortLesson,
  seedCohortCurriculum,
} from "../../catalog/actions";

type CourseLesson = {
  id: string;
  title: string;
  order: number;
  contentType: string;
  durationMin: number | null;
  module: { id: string; title: string; order: number };
};

type PlanEntry = {
  id: string;
  lessonId: string;
  order: number;
  releaseAt: string | null;
  lesson: CourseLesson;
};

type Cohort = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  course: { id: string; title: string; slug: string };
};

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/cohorts", label: "Cohorts", icon: "Group" as IconName },
  { href: "/admin/courses", label: "Courses", icon: "School" as IconName },
  { href: "/admin/enrollments", label: "Enrollments", icon: "Clipboard" as IconName },
];

function lessonIconName(t: string): IconName {
  switch (t) {
    case "VIDEO": return "Video";
    case "ARTICLE": return "Article";
    case "QUIZ": return "Quiz";
    case "ASSIGNMENT": return "Assignment";
    default: return "Book";
  }
}

export default function CohortCurriculumClient({
  cohort,
  courseLessons,
  plan: initialPlan,
}: {
  cohort: Cohort;
  courseLessons: CourseLesson[];
  plan: PlanEntry[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  const scheduled = useMemo(() => new Set(plan.map((p) => p.lessonId)), [plan]);
  const available = useMemo(
    () => courseLessons.filter((l) => !scheduled.has(l.id)),
    [courseLessons, scheduled],
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      after();
      router.refresh();
    });
  };

  const seedForm = () => {
    const fd = new FormData();
    fd.set("cohortId", cohort.id);
    return fd;
  };

  const onMove = (id: string, direction: "up" | "down") => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("direction", direction);
    run(() => moveCohortLesson(fd), () => {
      // Reordering is a swap, so the local list can be updated directly
      // rather than waiting for the server round-trip to repaint.
      setPlan((prev) => {
        const index = prev.findIndex((p) => p.id === id);
        const target = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next.map((p, i) => ({ ...p, order: i }));
      });
    });
  };

  const onRemove = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    run(() => removeCohortLesson(fd), () => {
      setPlan((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })));
    });
  };

  const onAdd = (lessonId: string) => {
    const fd = new FormData();
    fd.set("cohortId", cohort.id);
    fd.set("lessonId", lessonId);
    run(() => addCohortLesson(fd), () => {
      setShowAdd(false);
    });
  };

  return (
    <>
      <SubNav items={TABS} />

      <Breadcrumb
        items={[
          { label: "Manage", href: "/admin" },
          { label: "Cohorts", href: "/admin/cohorts" },
          { label: cohort.name },
        ]}
      />

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            <span>{cohort.course.title}</span>
            <span>·</span>
            <span>{new Date(cohort.startDate).toLocaleDateString()} – {new Date(cohort.endDate).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{cohort.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">Curriculum</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/cohorts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-dim"
          >
            <Icon.ArrowLeft className="h-4 w-4" />
            All cohorts
          </Link>
          {plan.length === 0 ? (
            <Button
              type="button"
              size="sm"
              loading={pending}
              onClick={() => run(() => seedCohortCurriculum(seedForm()), () => {})}
            >
              Use full course
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => setShowAdd((s) => !s)} disabled={available.length === 0}>
              <Icon.Plus className="h-4 w-4" />
              Add lesson
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {plan.length === 0 ? (
        <Card>
          <EmptyState
            icon="Layers"
            title="Teaching the whole course"
            description={`This cohort has no curriculum of its own, so students see every lesson in ${cohort.course.title} in course order. Add lessons, or schedule the whole course to reorder and gate individual lessons.`}
            action={{
              label: "Schedule the whole course",
              onClick: () => run(() => seedCohortCurriculum(seedForm()), () => {}),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {showAdd && (
            <Card>
              <h2 className="text-sm font-semibold text-ink">Add a lesson</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Only lessons from {cohort.course.title} can be scheduled in this cohort.
              </p>
              <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto">
                {available.map((l) => {
                  const I = Icon[lessonIconName(l.contentType)];
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onAdd(l.id)}
                        className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-surface-dim"
                      >
                        <I className="h-4 w-4 shrink-0 text-ink-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{l.title}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            Module {l.module.order} · {l.module.title}
                          </span>
                        </span>
                        <Icon.Plus className="h-4 w-4 shrink-0 text-ink-muted" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                {plan.length} lesson{plan.length === 1 ? "" : "s"} scheduled
              </h2>
              <button
                type="button"
                className="text-xs text-ink-muted underline hover:text-ink"
                onClick={() => {
                  if (!confirm("Clear this curriculum? The cohort will teach the whole course in course order.")) return;
                  const fd = new FormData();
                  fd.set("cohortId", cohort.id);
                  run(() => clearCohortCurriculum(fd), () => setPlan([]));
                }}
              >
                Clear and teach the whole course
              </button>
            </div>
            <ul className="divide-y divide-line">
              {plan.map((p, index) => {
                const I = Icon[lessonIconName(p.lesson.contentType)];
                return (
                  <li key={p.id}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                        {index + 1}
                      </span>
                      <I className="h-4 w-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{p.lesson.title}</p>
                        <p className="truncate text-xs text-ink-muted">
                          Module {p.lesson.module.order} · {p.lesson.module.title}
                          {p.lesson.durationMin ? ` · ${p.lesson.durationMin} min` : ""}
                        </p>
                      </div>
                      {p.releaseAt ? (
                        <Badge tone="warning">unlocks {new Date(p.releaseAt).toLocaleDateString()}</Badge>
                      ) : (
                        <Badge tone="neutral">immediate</Badge>
                      )}
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMove(p.id, "up")}
                          disabled={index === 0 || pending}
                          className="text-ink-muted hover:text-ink disabled:opacity-30"
                          aria-label={`Move ${p.lesson.title} up`}
                        >
                          <Icon.ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMove(p.id, "down")}
                          disabled={index === plan.length - 1 || pending}
                          className="text-ink-muted hover:text-ink disabled:opacity-30"
                          aria-label={`Move ${p.lesson.title} down`}
                        >
                          <Icon.ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          disabled={pending}
                          className="text-ink-muted hover:text-red-600"
                          aria-label={`Remove ${p.lesson.title} from this cohort`}
                        >
                          <Icon.Close className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
