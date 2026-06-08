"use client";

// /dashboard/courses — list of enrolled courses with progress.
// STUDENTs see their enrollments; staff see an empty-state nudge.

import Link from "next/link";
import { Card, PageHeader, ProgressBar, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { LearnTabs, useCourseFilters, SearchControls } from "../CoursesTabsClient";
import type { IconName } from "@/components/ui/Icon";

export type Enrollment = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED" | "SUSPENDED";
  progress: number;
  enrolledAt: string;
  course: {
    title: string;
    slug: string;
    instructor: { name: string | null };
    moduleCount: number;
  };
};

export type LearnTab = {
  href: string;
  label: string;
  icon: IconName;
  countKey: "all" | "active" | "completed";
};

export default function MyCoursesClient({
  enrollments,
  role,
  tabs,
}: {
  enrollments: Enrollment[];
  role: "STUDENT" | "INSTRUCTOR" | "MANAGER" | "ADMIN";
  tabs: LearnTab[];
}) {
  const { query, setQuery, status, setStatus, filtered } = useCourseFilters(enrollments, {
    pickQuery: (e) => [e.course.title, e.course.instructor.name ?? ""],
    pickStatus: (e) => e.status,
  });

  const counts = {
    all: enrollments.length,
    active: enrollments.filter((e) => e.status === "ACTIVE").length,
    completed: enrollments.filter((e) => e.status === "COMPLETED").length,
  };

  return (
    <>
      <LearnTabs
        tabs={tabs.map((t) => ({ ...t, count: counts[t.countKey] }))}
        status={status}
        onStatus={setStatus}
      />

      <PageHeader
        eyebrow="Learn · My courses"
        title="My courses"
        description={
          enrollments.length === 0
            ? role === "STUDENT"
              ? "Browse the catalog to enroll in your first course."
              : "Staff accounts don't take courses — supervise the catalog instead."
            : `${filtered.length} of ${enrollments.length} ${enrollments.length === 1 ? "course" : "courses"} shown`
        }
        accent="brand"
        action={
          role === "STUDENT" && (
            <Link
              href="/dashboard/courses/browse"
              className="inline-flex items-center gap-1.5 rounded-lg bg-hero px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] hover:opacity-95"
            >
              Browse catalog →
            </Link>
          )
        }
      />

      <SearchControls
        query={query}
        setQuery={setQuery}
        placeholder="Search enrolled courses…"
      />

      {enrollments.length === 0 ? (
        <EmptyState
          icon="School"
          title={role === "STUDENT" ? "No enrollments yet" : "Staff view"}
          description={
            role === "STUDENT"
              ? "Find a course in the catalog and click Enroll to get started."
              : "Staff accounts don't take courses. You can still browse the catalog at /dashboard/courses/browse."
          }
          action={
            role === "STUDENT"
              ? { label: "Browse catalog", href: "/dashboard/courses/browse" }
              : { label: "Browse catalog", href: "/dashboard/courses/browse" }
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="Search"
          title="No matches"
          description="Try clearing the search or status filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/courses/${e.course.slug}`}
              className="group block focus:outline-none"
            >
              <Card className="card-hover relative h-full overflow-hidden pt-7">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-hero transition-transform duration-200 group-hover:scale-x-100"
                />
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-base font-semibold text-ink">{e.course.title}</h3>
                  <Badge
                    tone={e.status === "COMPLETED" ? "success" : e.status === "ACTIVE" ? "info" : "neutral"}
                  >
                    {e.status.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {e.course.instructor.name ?? "Instructor"} · {e.course.moduleCount} modules
                </p>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Progress</span>
                    <span className="font-medium tabular-nums text-ink">{e.progress}%</span>
                  </div>
                  <ProgressBar value={e.progress} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

