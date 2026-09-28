"use client";

// Cohort form. Renders the inputs only — the page wraps it in a
// <Modal> so the same form is used for create and edit-in-place.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { upsertCohort, deleteCohort } from "../catalog/actions";

type Manager = { id: string; name: string | null; email: string; role: string };
type Course = { id: string; title: string; slug: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type CohortFormData = {
  id?: string;
  courseId?: string;
  name?: string;
  slug?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string | null;
  managerId?: string | null;
  capacity?: number | null;
  isOpen?: boolean;
};

function isoDate(d?: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function CohortFormFields({
  courses,
  managers,
  initial,
  onDone,
}: {
  courses: Course[];
  managers: Manager[];
  initial?: CohortFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // Whether the manager has typed in the slug field. Until they do, the
  // slug tracks the name. Derived during render rather than in an effect:
  // an effect that calls setState forces a second render pass on every
  // keystroke, and the value is fully determined by the name.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  // An existing cohort's slug is never auto-rewritten — changing a live
  // slug would break inbound links.
  const effectiveSlug =
    initial?.id || slugTouched ? slug : slugify(name);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await upsertCohort(fd);
          if (!res.ok) { setError(res.error); return; }
          router.refresh();
          onDone?.();
          if (!initial?.id) {
            // Reset fields for repeated "create" use. Clearing the touched
            // flag returns the slug to auto-derived mode.
            setName(""); setSlug(""); setSlugTouched(false);
            (e.target as HTMLFormElement).reset();
          }
        });
      }}
      className="space-y-3"
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Field
        label="Course"
        name="courseId"
        hint={
          initial?.id
            ? "A cohort with enrolled students can't be moved to another course."
            : "A cohort is an intake of one course. Required."
        }
      >
        <select
          name="courseId"
          required
          defaultValue={initial?.courseId ?? ""}
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="" disabled>
            — Select a course —
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name" name="name">
        <Input
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Slug" name="slug" hint="Leave blank to auto-generate from the name">
        <Input
          name="slug"
          maxLength={80}
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="startDate">
          <Input
            type="date"
            name="startDate"
            required
            defaultValue={isoDate(initial?.startDate)}
          />
        </Field>
        <Field label="End" name="endDate">
          <Input
            type="date"
            name="endDate"
            required
            defaultValue={isoDate(initial?.endDate)}
          />
        </Field>
      </div>
      <Field
        label="Capacity"
        name="capacity"
        hint="Optional seat cap. Leave blank for unlimited. Applies to staff enrollment too."
      >
        <Input
          type="number"
          name="capacity"
          min={1}
          max={10000}
          defaultValue={initial?.capacity ?? ""}
        />
      </Field>

      <label className="flex items-start gap-2 rounded-lg border border-line bg-surface-dim px-3 py-2.5">
        <input
          type="checkbox"
          name="isOpen"
          defaultChecked={initial?.isOpen ?? true}
          className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30"
        />
        <span className="text-sm text-ink">
          Open for self-enrollment
          <span className="block text-xs text-ink-muted">
            When off, students can&apos;t request a seat. Managers can still enroll
            students directly.
          </span>
        </span>
      </label>

      <Field label="Description" name="description">
        <Textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.description ?? ""}
        />
      </Field>
      <Field label="Manager" name="managerId" hint="Optional. Must be a MANAGER or ADMIN.">
        <select
          name="managerId"
          defaultValue={initial?.managerId ?? ""}
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">— Unassigned —</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email} ({m.role.toLowerCase()})
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Create cohort"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCohortButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
        disabled={pending || disabled}
        onClick={() => {
          if (!confirm("Delete this cohort? This cannot be undone.")) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          startTransition(async () => {
            const res = await deleteCohort(fd);
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
