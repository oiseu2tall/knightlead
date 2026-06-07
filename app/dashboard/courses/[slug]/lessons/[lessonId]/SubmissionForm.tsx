"use client";

// Assignment submission form. Handles file uploads via the local
// storage endpoint, then submits the form via the server action.
import { useState, useTransition } from "react";
import { Field, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useUpload } from "@/lib/use-upload";
import { submitAssignment } from "@/app/dashboard/assignments/actions";

type Attachment = { key: string; name: string; size: number; url: string };

export function SubmissionForm({
  assignmentId,
  maxScore,
}: {
  assignmentId: string;
  maxScore: number;
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const { state: uploadState, upload, reset } = useUpload();

  const onAddFile = async (file: File) => {
    setError(null);
    const obj = await upload(file);
    if (obj) {
      setAttachments((prev) => [
        ...prev,
        { key: obj.key, name: file.name, size: obj.size, url: obj.url },
      ]);
      reset();
    } else if (uploadState.status === "error") {
      setError(uploadState.error);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Add a description before submitting.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("assignmentId", assignmentId);
      fd.set("content", content);
      fd.set("attachments", JSON.stringify(attachments.map((a) => a.key)));
      const res = await submitAssignment(fd);
      if (res.ok) {
        setSuccess(true);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Submitted.</p>
        <p className="mt-1 text-green-700">
          Your work has been recorded. Your instructor will grade it soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={`Your submission (max score: ${maxScore})`}
        name="content"
        hint="Describe your approach, then attach any files (PDF, image, code archive)."
      >
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          maxLength={20_000}
        />
      </Field>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink">Attachments</p>
        {attachments.length > 0 && (
          <ul className="mb-2 space-y-1">
            {attachments.map((a) => (
              <li
                key={a.key}
                className="flex items-center justify-between rounded-md border border-line bg-surface-dim px-3 py-1.5 text-xs"
              >
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-500 hover:underline">
                  {a.name}
                </a>
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
            className="hidden"
            disabled={uploadState.status === "uploading" || attachments.length >= 5}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAddFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">Up to 5 files. PDF, images, zip, docs.</p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" loading={pending} disabled={uploadState.status === "uploading"}>
        Submit assignment
      </Button>
    </form>
  );
}
