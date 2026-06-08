"use client";

// Course form — fields only; the page wraps it in a <Modal>.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { upsertCourse, deleteCourse } from "../catalog/actions";

type Person = { id: string; name: string | null; email: string; role: string };

export type CourseFormData = {
  id?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  instructorId?: string;
  managerId?: string | null;
  isPublished?: boolean;
};

export function CourseFormFields({
  instructors,
  managers,
  initial,
  onDone,
}: {
  instructors: Person[];
  managers: Person[];
  initial?: CourseFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");

  // Auto-derive a slug from the title when the slug field is empty.
  useEffect(() => {
    if (initial?.id) return;
    if (slug.length > 0) return;
    const derived = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    setSlug(derived);
  }, [title, slug, initial?.id]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await upsertCourse(fd);
          if (!res.ok) { setError(res.error); return; }
          router.refresh();
          onDone?.();
        });
      }}
      className="space-y-3"
    >
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Title" name="title">
        <Input
          name="title"
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Slug" name="slug" hint="Leave blank to auto-generate from the title">
        <Input
          name="slug"
          maxLength={80}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>
      <Field label="Description" name="description">
        <Textarea
          name="description"
          rows={3}
          maxLength={4000}
          defaultValue={initial?.description ?? ""}
        />
      </Field>
      <Field label="Thumbnail URL" name="thumbnailUrl">
        <Input
          type="url"
          name="thumbnailUrl"
          maxLength={500}
          defaultValue={initial?.thumbnailUrl ?? ""}
          placeholder="https://…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Instructor" name="instructorId" hint="Must be INSTRUCTOR or ADMIN">
          <select
            name="instructorId"
            required
            defaultValue={initial?.instructorId ?? ""}
            className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="" disabled>— Pick one —</option>
            {instructors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.email} ({p.role.toLowerCase()})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catalog manager" name="managerId" hint="Optional">
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
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={!!initial?.isPublished}
          className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500"
        />
        <span>
          <span className="font-medium">Published</span>
          <span className="ml-1 text-ink-muted">— visible to students for enrollment</span>
        </span>
      </label>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Create course"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCourseButton({ id, disabled }: { id: string; disabled?: boolean }) {
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
          if (!confirm("Delete this course? This cannot be undone.")) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          startTransition(async () => {
            const res = await deleteCourse(fd);
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
