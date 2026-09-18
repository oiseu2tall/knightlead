"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { deleteUser } from "./actions";

export function UserRowActions({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/admin/users/${userId}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50/50 hover:text-brand-600"
      >
        <Icon.Edit className="h-3.5 w-3.5" />
        Edit
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this user? This cannot be undone.")) return;
          const fd = new FormData();
          fd.set("id", userId);
          startTransition(async () => {
            const res = await deleteUser(fd);
            if (!res.ok) {
              alert(res.error);
              return;
            }
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
        title="Delete user"
      >
        <Icon.Trash className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}
