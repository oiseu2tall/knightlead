"use client";

// Role selector for a single user. Posts via the changeUserRole
// server action and uses optimistic state to flip the value
// immediately.
import { useOptimistic, useTransition } from "react";
import { changeUserRole } from "./actions";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "MANAGER", "ADMIN"];

export function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: Role;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic<Role, Role>(currentRole);

  return (
    <select
      value={optimistic}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Role;
        startTransition(async () => {
          setOptimistic(next);
          const fd = new FormData();
          fd.set("userId", userId);
          fd.set("role", next);
          const res = await changeUserRole(fd);
          if (!res.ok) {
            // Roll back by re-rendering with the server-side value.
            setOptimistic(currentRole);
            alert(res.error); // simple surface; swap for a toast later
          }
        });
      }}
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50"
      aria-label="Change role"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r.toLowerCase()}</option>
      ))}
    </select>
  );
}
