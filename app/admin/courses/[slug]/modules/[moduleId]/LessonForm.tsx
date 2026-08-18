"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { upsertLesson, deleteLesson } from "../../../../catalog/actions";

export type LessonFormData = {
  id?: string;
  moduleId?: string;
  title?: string;
  contentType?: string;
  content?: string;
  videoUrl?: string;
  durationMin?: number;
  order?: number;
  isFree?: boolean;
};

export function LessonFormFields({
  moduleId,
  nextOrder,
  initial,
  onDone,
}: {
  moduleId: string;
  nextOrder: number;
  initial?: LessonFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentType, setContentType] = useState(initial?.contentType ?? "ARTICLE");
  const [content, setContent] = useState(initial?.content ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? "");
  const [order, setOrder] = useState(initial?.order ?? nextOrder);
  const [isFree, setIsFree] = useState(initial?.isFree ?? false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("moduleId", moduleId);
    fd.set("title", title);
    fd.set("contentType", contentType);
    fd.set("content", content);
    fd.set("videoUrl", videoUrl);
    fd.set("durationMin", String(durationMin));
    fd.set("order", String(order));
    fd.set("isFree", isFree ? "on" : "");
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await upsertLesson(fd);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
      onDone?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Title" name="title">
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </Field>
      <Field label="Type" name="contentType">
        <select
          name="contentType"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="VIDEO">Video</option>
          <option value="ARTICLE">Article</option>
          <option value="QUIZ">Quiz</option>
          <option value="ASSIGNMENT">Assignment</option>
          <option value="LIVE_SESSION">Live session</option>
        </select>
      </Field>
      <Field label="Order" name="order" hint="Lower numbers come first.">
        <Input
          type="number"
          name="order"
          min={0}
          max={999}
          required
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
      </Field>
      <Field label="Content" name="content" hint="Article body or notes. Plain text; Markdown support coming soon.">
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          maxLength={20000}
        />
      </Field>
      <Field label="Video URL" name="videoUrl" hint="Optional. HTTPS link to a video file or stream.">
        <Input
          type="url"
          name="videoUrl"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="Duration (minutes)" name="durationMin" hint="Optional.">
        <Input
          type="number"
          name="durationMin"
          min={0}
          max={600}
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value ? Number(e.target.value) : "")}
        />
      </Field>
      <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="isFree"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
          className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500"
        />
        <span>
          <span className="font-medium">Free preview</span>
          <span className="ml-1 text-ink-muted">— visible to non-enrolled visitors</span>
        </span>
      </label>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Add lesson"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteLessonButton({ id, title }: { id: string; title: string }) {
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
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete lesson "${title}"? Any assignments inside it will also be removed.`)) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          startTransition(async () => {
            const res = await deleteLesson(fd);
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
