"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { upsertModule, deleteModule } from "../../catalog/actions";

export function ModuleForm({
  courseId,
  nextOrder,
}: {
  courseId: string;
  nextOrder: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 text-sm font-semibold text-ink">Add module</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          fd.set("courseId", courseId);
          startTransition(async () => {
            const res = await upsertModule(fd);
            if (!res.ok) { setError(res.error); return; }
            router.refresh();
            (e.target as HTMLFormElement).reset();
            // Restore the suggested next order after the form reset.
            const orderEl = (e.target as HTMLFormElement).elements.namedItem("order") as HTMLInputElement | null;
            if (orderEl) orderEl.value = String(Number(orderEl.value || 0) + 1);
          });
        }}
        className="space-y-3"
      >
        <Field label="Title" name="title">
          <Input name="title" required maxLength={160} />
        </Field>
        <Field label="Order" name="order" hint="Lower numbers come first. Existing modules at or after this order are bumped down.">
          <Input
            type="number"
            name="order"
            min={0}
            max={999}
            required
            defaultValue={nextOrder}
          />
        </Field>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Add module
        </Button>
      </form>
    </div>
  );
}

export function DeleteModuleButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this module? Lessons inside it will also be removed.")) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          startTransition(async () => {
            const res = await deleteModule(fd);
            if (!res.ok) { setError(res.error); return; }
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
