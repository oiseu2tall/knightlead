"use client";

// Module form — fields only; the page wraps it in a <Modal>.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useUpload } from "@/lib/use-upload";
import { upsertModule, deleteModule } from "../../catalog/actions";

type Attachment = { key: string; name: string; size: number; url: string };

export type ModuleFormData = {
  id?: string;
  title?: string;
  order?: number;
  fileKey?: string | null;
  fileName?: string | null;
};

export function ModuleFormFields({
  courseId,
  nextOrder,
  initial,
  onDone,
}: {
  courseId: string;
  nextOrder: number;
  initial?: ModuleFormData;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [order, setOrder] = useState(initial?.order ?? nextOrder);
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    if (initial?.fileKey && initial?.fileName) {
      return [{
        key: initial.fileKey,
        name: initial.fileName,
        size: 0,
        url: `/api/files/${encodeURIComponent(initial.fileKey)}?t=`,
      }];
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
    fd.set("courseId", courseId);
    fd.set("title", title);
    fd.set("order", String(order));
    if (initial?.id) fd.set("id", initial.id);
    fd.set("fileKey", attachments.length > 0 ? attachments[0].key : "");
    fd.set("fileName", attachments.length > 0 ? attachments[0].name : "");
    fd.set("fileSize", attachments.length > 0 ? String(attachments[0].size) : "");
    fd.set("fileType", "");
    startTransition(async () => {
      const res = await upsertModule(fd);
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
      <Field label="Order" name="order" hint="Lower numbers come first. Existing modules at or after this order are bumped down.">
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

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink">Module file (PDF / PowerPoint)</p>
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
            accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            disabled={uploadState.status === "uploading" || attachments.length >= 1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAddFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">Optional. PDF or PowerPoint, max 50 MB.</p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          {initial?.id ? "Save changes" : "Add module"}
        </Button>
      </div>
    </form>
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
        size="sm"
        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
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
