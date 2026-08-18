"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useUpload } from "@/lib/use-upload";
import { upsertAssignment, deleteAssignment } from "../../../../catalog/actions";

type Attachment = { key: string; name: string; size: number; url: string };

export type AssignmentFormData = {
  id?: string;
  lessonId?: string;
  title?: string;
  prompt?: string;
  dueDate?: string;
  maxScore?: number;
  attachments?: string[];
};

export function AssignmentFormFields({
  courseId: _courseId,
  lessons,
  initial,
  onDone,
}: {
  courseId: string;
  lessons: { id: string; title: string; contentType: string }[];
  initial?: AssignmentFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lessonId, setLessonId] = useState(initial?.lessonId ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0, 16) : "");
  const [maxScore, setMaxScore] = useState(initial?.maxScore ?? 100);
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    if (initial?.attachments && initial.attachments.length > 0) {
      return initial.attachments.map((key) => ({
        key,
        name: key.split("/").pop() ?? key,
        size: 0,
        url: `/api/files/${encodeURIComponent(key)}?t=`,
      }));
    }
    return [];
  });
  const { state: uploadState, upload, reset } = useUpload();

  const onAddFile = async (file: File) => {
    setError(null);
    const obj = await upload(file);
    if (obj) {
      setAttachments((prev) => [
        ...prev.filter((a) => a.key !== obj.key),
        { key: obj.key, name: file.name, size: obj.size, url: obj.url },
      ]);
      reset();
    } else if (uploadState.status === "error") {
      setError(uploadState.error);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("lessonId", lessonId);
    fd.set("title", title);
    fd.set("prompt", prompt);
    fd.set("dueDate", dueDate);
    fd.set("maxScore", String(maxScore));
    fd.set("attachments", JSON.stringify(attachments.map((a) => a.key)));
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await upsertAssignment(fd);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
      onDone?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Lesson" name="lessonId" hint="Attach this assignment to a lesson">
        <select
          name="lessonId"
          required
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="" disabled>— Pick a lesson —</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.contentType.toLowerCase().replace("_", " ")})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title" name="title">
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </Field>
      <Field label="Prompt / Instructions" name="prompt">
        <Textarea name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={10000} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date" name="dueDate" hint="Optional">
          <Input type="datetime-local" name="dueDate" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Max score" name="maxScore">
          <Input type="number" name="maxScore" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} required />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink">Assignment files (templates, worksheets)</p>
        {attachments.length > 0 && (
          <ul className="mb-2 space-y-1">
            {attachments.map((a) => (
              <li
                key={a.key}
                className="flex items-center justify-between rounded-md border border-line bg-surface-dim px-3 py-1.5 text-xs"
              >
                <span className="truncate text-ink">{a.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((x) => x.key !== a.key))}
                  className="text-ink-muted hover:text-red-600"
                  aria-label={`Remove ${a.name}`}
                >
                  <Icon.Close className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm text-ink-muted hover:border-brand-500 hover:text-ink">
          <Icon.Upload className="h-4 w-4" />
          {uploadState.status === "uploading" ? "Uploading…" : "Add file"}
          <input
            type="file"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,.md"
            className="hidden"
            disabled={uploadState.status === "uploading" || attachments.length >= 5}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAddFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">Optional. Up to 5 files, 50 MB each. PDF, docs, slides, zip.</p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Add assignment"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteAssignmentButton({ id, title }: { id: string; title: string }) {
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
          if (!confirm(`Delete assignment "${title}"? Submissions will also be removed.`)) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          startTransition(async () => {
            const res = await deleteAssignment(fd);
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
