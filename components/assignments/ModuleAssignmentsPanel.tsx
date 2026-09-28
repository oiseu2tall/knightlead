"use client";

// A module's assignments, each with a live submission form.
//
// Assessments are module-level, so this panel is what "doing the work" for
// a module looks like. It is shared by the lesson page (where the module's
// work always sits below the lesson) and the course page (where a
// deep-linked module is expanded inline) so the two cannot drift.
//
// URLs for assignment files are signed server-side — `signToken` needs
// node:crypto — and passed in already built.

import { Icon } from "@/components/ui/Icon";
import { AssignmentFileLinks } from "@/components/files/AssignmentFileLinks";
import { SubmissionForm } from "@/components/assignments/SubmissionForm";

export type ModuleAssignmentView = {
  id: string;
  title: string;
  prompt: string;
  /** ISO string, or null when the assignment has no due date. */
  dueDate: string | null;
  maxScore: number;
  files: Array<{ key: string; name: string; url: string }>;
  submission: {
    content: string;
    attachments: string[];
    status: "SUBMITTED" | "GRADED" | "RETURNED" | "LATE";
    score: number | null;
    feedback: string | null;
    submittedAt: string;
    gradedAt: string | null;
  } | null;
};

export function ModuleAssignmentsPanel({
  moduleTitle,
  assignments,
  /** Anchor for deep links, e.g. "assignment-abc123". */
  idPrefix = "assignment",
}: {
  moduleTitle: string;
  assignments: ModuleAssignmentView[];
  idPrefix?: string;
}) {
  if (assignments.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Module assignments</h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        These cover <span className="font-medium text-ink">{moduleTitle}</span> as a whole.
      </p>
      <div className="mt-4 space-y-6">
        {assignments.map((assignment, index) => (
          <div
            // Deep links from /dashboard/assignments land here, so the
            // browser scrolls straight to the assignment the student meant.
            key={assignment.id}
            id={`${idPrefix}-${assignment.id}`}
            className="scroll-mt-24 border-t border-line pt-4 first:border-0 first:pt-0"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{assignment.title}</p>
              {assignment.dueDate && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                  <Icon.Calendar className="h-3.5 w-3.5" />
                  Due {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink">{assignment.prompt}</p>
            <AssignmentFileLinks files={assignment.files} />
            <div className="mt-4">
              <SubmissionForm
                assignmentId={assignment.id}
                maxScore={assignment.maxScore}
                existing={assignment.submission}
              />
            </div>
            {index === 0 && assignments.length > 1 && (
              <p className="mt-4 text-xs text-ink-muted">
                This module has {assignments.length} assignments — each is submitted separately.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
