"use client";

// /dashboard/courses/browse — published course catalog with search and
// status filter. STUDENTs see an Enroll button; staff see a read-only
// notice.

import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { LearnTabs, SearchControls } from "../../CoursesTabsClient";
import { useMemo, useState } from "react";
import { EnrollButton } from "./EnrollButton";
import { Icon, type IconName } from "@/components/ui/Icon";

export type BrowseCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: { name: string | null; email: string };
  moduleCount: number;
  enrollmentCount: number;
  enrolled: "ACTIVE" | "COMPLETED" | "DROPPED" | "SUSPENDED" | null;
};

export type LearnTab = {
  href: string;
  label: string;
  icon: IconName;
  countKey: "all" | "active" | "completed";
};

export default function BrowseClient({
  courses,
  canEnroll,
  tabs,
}: {
  courses: BrowseCourse[];
  canEnroll: boolean;
  tabs: LearnTab[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.instructor.name ?? "").toLowerCase().includes(q),
    );
  }, [courses, query]);

  return (
    <>
      <LearnTabs
        tabs={tabs}
        status="all"
        onStatus={() => {
          /* no-op; status filter is hidden on browse */
        }}
      />

      <PageHeader
        eyebrow="Learn · Browse catalog"
        title="Browse courses"
        description={
          canEnroll
            ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} available.`
            : "You're viewing the catalog as staff. Enrollment is for students only."
        }
        accent="brand"
      />

      {!canEnroll && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong className="font-semibold">Staff view:</strong> you can browse
          the catalog, but enrollment is restricted to students.
        </div>
      )}

      <SearchControls
        query={query}
        setQuery={setQuery}
        placeholder="Search courses…"
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="School"
          title="No published courses yet"
          description="Once an admin or manager publishes a course, it will show up here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="Search"
          title="No matches"
          description="Try a different search term."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="flex h-full flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-base font-semibold text-ink">{c.title}</h3>
                {c.enrolled && (
                  <Badge tone={c.enrolled === "COMPLETED" ? "success" : "info"}>
                    {c.enrolled.toLowerCase()}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                {c.instructor.name ?? c.instructor.email} · {c.moduleCount} modules · {c.enrollmentCount} enrolled
              </p>
              {c.description && (
                <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{c.description}</p>
              )}
              <div className="mt-auto pt-4">
                {canEnroll ? (
                  c.enrolled ? (
                    <Link
                      href={`/dashboard/courses/${c.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-dim"
                    >
                      Continue learning →
                    </Link>
                  ) : (
                    <EnrollButton courseId={c.id} />
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                    <Icon.Group className="h-4 w-4" />
                    Enrollment disabled for staff.
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
