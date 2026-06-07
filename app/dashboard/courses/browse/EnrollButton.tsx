"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { enrollInCourse } from "../actions";

export function EnrollButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="accent"
        loading={pending}
        onClick={() => {
          setError(null);
          const fd = new FormData();
          fd.set("courseId", courseId);
          startTransition(async () => {
            const res = await enrollInCourse(fd);
            if (!res.ok) { setError(res.error); return; }
            router.push("/dashboard/courses");
            router.refresh();
          });
        }}
      >
        Enroll
      </Button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
