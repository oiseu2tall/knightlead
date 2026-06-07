"use client";

// Optimistic grading panel. Updates the score locally the moment
// the instructor clicks "Save grade", then reconciles with the server.
import { useOptimistic, useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Field, Textarea, Input } from "@/components/ui/Field";
import { gradeSubmission, returnSubmission } from "./actions";

type SubmissionView = {
  id: string;
  content: string;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: Date;
  student: { id: string; name: string | null; email: string | null; image: string | null };
  assignment: {
    id: string;
    title: string;
    maxScore: number;
    lessonTitle: string;
    courseTitle: string;
    courseSlug: string;
  };
};

type Optimistic = { status: string; score: number | null };

export function GradingPanel({ submission }: { submission: SubmissionView }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<string>(submission.score?.toString() ?? "");
  const [feedback, setFeedback] = useState<string>(submission.feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic<Optimistic, Optimistic>(
    { status: submission.status, score: submission.score },
    (_current, next) => next,
  );

  const onSave = () => {
    setError(null);
    const num = Number(score);
    if (!Number.isFinite(num) || num < 0 || num > submission.assignment.maxScore) {
      setError(`Score must be 0–${submission.assignment.maxScore}`);
      return;
    }
    startTransition(async () => {
      setOptimistic({ status: "GRADED", score: num });
      const fd = new FormData();
      fd.set("submissionId", submission.id);
      fd.set("score", String(num));
      fd.set("feedback", feedback);
      const res = await gradeSubmission(fd);
      if (!res.ok) {
        setError(res.error);
        // The optimistic state will revert when the transition completes without
        // a revalidate, but since the server didn't update, a manual revert
        // is clearer — reloading the page resets from the DB.
      }
    });
  };

  const onReturn = () => {
    startTransition(async () => {
      setOptimistic({ status: "RETURNED", score: optimistic.score });
      const fd = new FormData();
      fd.set("submissionId", submission.id);
      await returnSubmission(fd);
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{submission.assignment.title}</h3>
          <p className="text-xs text-ink-muted">
            {submission.assignment.courseTitle} · {submission.assignment.lessonTitle}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            From {submission.student.name ?? submission.student.email} ·{" "}
            {submission.submittedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            tone={
              optimistic.status === "GRADED" ? "success" :
              optimistic.status === "RETURNED" ? "info" : "warning"
            }
          >
            {optimistic.status.toLowerCase()}
          </Badge>
          {optimistic.score != null && (
            <span className="rounded-md bg-surface-dim px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
              {optimistic.score}/{submission.assignment.maxScore}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-md border border-line bg-surface-dim p-3 text-sm text-ink">
        <p className="whitespace-pre-wrap">{submission.content}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cancel" : submission.score == null ? "Grade" : "Edit grade"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReturn}
          loading={pending}
        >
          Return
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Field
            label={`Score (0–${submission.assignment.maxScore})`}
            name="score"
            error={error ?? undefined}
          >
            <Input
              type="number"
              name="score"
              min={0}
              max={submission.assignment.maxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              invalid={!!error}
            />
          </Field>
          <Field label="Feedback" name="feedback">
            <Textarea
              name="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="What went well, what to improve…"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="button" onClick={onSave} loading={pending}>
              Save grade
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
