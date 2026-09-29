import Link from "next/link";
import { Card, Badge } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import type { Curriculum } from "@/lib/curriculum";

/**
 * Read-only course preview for admins who hold no seat.
 *
 * Renders the same curriculum a student would see, minus everything that
 * depends on an enrollment: no progress, no release gates, and no
 * submission forms. The banner says so, because a preview that looks
 * identical to the real thing is how an admin ends up believing they
 * marked a lesson complete.
 */
export function CoursePreview({
  courseSlug,
  courseTitle,
  curriculum,
  assignmentCountByModule,
}: {
  courseSlug: string;
  courseTitle: string;
  curriculum: Curriculum;
  /** Total assignments per module, for the "N assignments" hint. */
  assignmentCountByModule: Map<string, number>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <Icon.Settings className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Preview mode.</span> You&apos;re viewing
          the full curriculum as an admin. You hold no seat in this course, so
          there is no progress to track, no release schedule, and nothing to
          submit.
        </p>
      </div>

      {curriculum.modules.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            This course has no lessons yet.
          </p>
        </Card>
      ) : (
        curriculum.modules.map((m, index) => {
          const assignmentCount = assignmentCountByModule.get(m.moduleId) ?? 0;
          return (
            <Card key={m.moduleId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">
                  <span className="text-ink-muted">
                    {String(index + 1).padStart(2, "0")} ·{" "}
                  </span>
                  {m.moduleTitle}
                </h2>
                <Badge tone="neutral">
                  {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}
                  {assignmentCount > 0
                    ? ` · ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"}`
                    : ""}
                </Badge>
              </div>

              <ul className="mt-3 divide-y divide-line">
                {m.lessons.map((l) => (
                  <li key={l.lessonId}>
                    <Link
                      href={`/dashboard/courses/${courseSlug}/lessons/${l.lessonId}`}
                      className="flex items-center gap-3 py-2.5 text-sm text-ink hover:text-brand-500"
                    >
                      <Icon.Book className="h-4 w-4 shrink-0 text-ink-muted" />
                      <span className="min-w-0 flex-1 truncate">{l.lessonTitle}</span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {l.contentType.toLowerCase().replace(/_/g, " ")}
                        {l.durationMin ? ` · ${l.durationMin} min` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      <p className="text-xs text-ink-muted">
        Previewing <span className="font-medium text-ink">{courseTitle}</span> ·
        {" "}
        <Link href={`/dashboard/courses/browse`} className="hover:text-brand-500 hover:underline">
          Back to catalog
        </Link>
      </p>
    </div>
  );
}
