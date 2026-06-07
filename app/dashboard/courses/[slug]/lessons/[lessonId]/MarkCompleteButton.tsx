"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { markLessonComplete } from "@/app/dashboard/courses/actions";

export function MarkCompleteButton({
  lessonId,
  courseSlug,
  className,
}: {
  lessonId: string;
  courseSlug: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  // Optimistically flip the UI to "complete" the moment the button is clicked;
  // the server action's revalidatePath() will reconcile the real value.
  const [optimisticDone, setOptimisticDone] = useOptimistic(false);

  return (
    <Button
      type="button"
      variant="primary"
      loading={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          setOptimisticDone(true);
          const fd = new FormData();
          fd.set("lessonId", lessonId);
          fd.set("courseSlug", courseSlug);
          await markLessonComplete(fd);
        });
      }}
    >
      {optimisticDone ? "Marked complete ✓" : "Mark as complete"}
    </Button>
  );
}
