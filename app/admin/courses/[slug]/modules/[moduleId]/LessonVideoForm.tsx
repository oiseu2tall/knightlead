"use client";

// Manage one video on a lesson. A lesson may carry several videos, each
// sourced either from an external URL or from a file in the local store —
// one or the other, never both, so the player never has to guess which to
// render.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useUpload } from "@/lib/use-upload";
import { upsertLessonVideo } from "../../../../catalog/actions";

export type LessonVideoFormData = {
  id?: string;
  title?: string;
  description?: string;
  url?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  durationMin?: number;
  order?: number;
};

export function LessonVideoFormFields({
  lessonId,
  nextOrder,
  initial,
  onDone,
}: {
  lessonId: string;
  nextOrder: number;
  initial?: LessonVideoFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [uploaded, setUploaded] = useState<{ key: string; name: string; size: number; type: string } | null>(
    initial?.fileKey
      ? { key: initial.fileKey, name: initial.fileName ?? initial.fileKey, size: initial.fileSize ?? 0, type: initial.fileType ?? "" }
      : null,
  );
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? "");
  const [order, setOrder] = useState(initial?.order ?? nextOrder);
  const { state: uploadState, upload, reset } = useUpload();

  const onAddFile = async (file: File) => {
    setError(null);
    const obj = await upload(file);
    if (obj) {
      setUploaded({ key: obj.key, name: file.name, size: obj.size, type: file.type });
      // An uploaded file and an external URL are alternatives, so storing
      // one clears the other rather than leaving a form that would submit
      // an invalid combination.
      setUrl("");
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
    fd.set("description", description);
    fd.set("url", url);
    fd.set("durationMin", String(durationMin));
    fd.set("order", String(order));
    if (uploaded) {
      fd.set("fileKey", uploaded.key);
      fd.set("fileName", uploaded.name);
      if (uploaded.size) fd.set("fileSize", String(uploaded.size));
      if (uploaded.type) fd.set("fileType", uploaded.type);
    }
    if (initial?.id) fd.set("id", initial.id);
    startTransition(async () => {
      const res = await upsertLessonVideo(fd);
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
      <Field label="Description" name="description" hint="Optional. What this video covers.">
        <Textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={5000}
        />
      </Field>

      <div className="rounded-lg border border-line bg-surface-dim p-3 space-y-2">
        <p className="text-xs font-medium text-ink">Video source</p>
        <p className="text-xs text-ink-muted">
          Link to a hosted video, or upload a file. Use one or the other.
        </p>
        <Field label="External URL" name="url" hint="HTTPS link to a video file or stream.">
          <Input
            type="url"
            name="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (e.target.value) setUploaded(null); }}
            placeholder="https://…"
            disabled={!!uploaded}
          />
        </Field>
        {uploaded ? (
          <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-xs">
            <span className="truncate text-ink">
              <Icon.File className="mr-1.5 inline h-3.5 w-3.5" />
              {uploaded.name}
            </span>
            <button
              type="button"
              onClick={() => setUploaded(null)}
              className="shrink-0 text-ink-muted hover:text-red-600"
              aria-label={`Remove ${uploaded.name}`}
            >
              <Icon.Close className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm text-ink-muted hover:border-brand-500 hover:text-ink">
            <Icon.Upload className="h-4 w-4" />
            {uploadState.status === "uploading" ? "Uploading…" : "Upload video"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogv,.mov"
              className="hidden"
              disabled={uploadState.status === "uploading"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAddFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <Field label="Order" name="order" hint="Lower numbers play first.">
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
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Add video"}
        </Button>
      </div>
    </form>
  );
}
