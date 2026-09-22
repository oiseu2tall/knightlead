"use client";

// Suspend / activate toggle for a single user. Posts via the
// setUserSuspended server action and uses optimistic state.
import { useState, useTransition } from "react";
import { setUserSuspended } from "./actions";

export function SuspendToggle({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(suspended);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !optimistic;
        if (!confirm(
          next
            ? "Suspend this user? They will be locked out of the LMS until reactivated."
            : "Activate this user? They will be able to sign in again."
        )) return;
        setOptimistic(next);
        startTransition(async () => {
          const fd = new FormData();
          fd.set("id", userId);
          fd.set("suspended", next ? "true" : "false");
          const res = await setUserSuspended(fd);
          if (!res.ok) {
            alert(res.error);
            setOptimistic(!next);
          }
        });
      }}
      className={[
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        optimistic
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
      ].join(" ")}
      title={optimistic ? "Click to activate" : "Click to suspend"}
    >
      {pending ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : optimistic ? (
        "Suspended"
      ) : (
        "Active"
      )}
    </button>
  );
}