"use client";

// Assignment submission form — polished.
//   - Pre-fills from an existing submission (so "Save" means "update").
//   - Shows grade + feedback inline if already graded.
//   - Character counter, Cmd/Ctrl+Enter shortcut, drag-and-drop upload,
//     per-file upload progress, and a 5-file cap.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useUpload } from "@/lib/use-upload";
import { submitAssignment } from "@/app/dashboard/assignments/actions";

type Attachment = { key: string; name: string; size: number; url: string };

type ExistingSubmission = {
  content: string;
  attachments: string[]; // file keys
  status: "SUBMITTED" | "GRADED" | "RETURNED" | "LATE";
  score: number | null;
  feedback: string | null;
  submittedAt: string; // serialized
  gradedAt: string | null;
};

const MAX_CHARS = 20_000;
const MAX_FILES = 5;

export function SubmissionForm({
  assignmentId,
  maxScore,
  existing,
}: {
  assignmentId: string;
  maxScore: number;
  existing: ExistingSubmission | null;
}) {
  const [content, setContent] = useState(existing?.content ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ at: string; updated: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { state: uploadState, upload, reset } = useUpload();

  // Cmd/Ctrl+Enter submits the form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    const form = formRef.current;
    form?.addEventListener("keydown", onKey as unknown as EventListener);
    return () => form?.removeEventListener("keydown", onKey as unknown as EventListener);
  }, []);

  const onAddFile = useCallback(
    async (file: File) => {
      setError(null);
      const obj = await upload(file);
      if (obj) {
        setAttachments((prev) => {
          if (prev.length >= MAX_FILES) return prev;
          return [...prev, { key: obj.key, name: file.name, size: obj.size, url: obj.url }];
        });
        reset();
      } else if (uploadState.status === "error") {
        setError(uploadState.error);
      }
    },
    [upload, uploadState, reset],
  );

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_FILES - attachments.length;
    const toAdd = Array.from(files).slice(0, remaining);
    void Promise.all(toAdd.map(onAddFile));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Add a description before submitting.");
      return;
    }
    if (uploadState.status === "uploading") {
      setError("Wait for the file upload to finish.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("assignmentId", assignmentId);
      fd.set("content", content);
      fd.set("attachments", JSON.stringify(attachments.map((a) => a.key)));
      const res = await submitAssignment(fd);
      if (res.ok) {
        setSubmitted({ at: new Date().toISOString(), updated: !!existing });
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  // If a graded submission exists, show the grade + feedback up top.
  if (existing && existing.status === "GRADED" && !submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-900">Graded</p>
              <p className="mt-0.5 text-xs text-green-800">
                Submitted {new Date(existing.submittedAt).toLocaleString()}
                {existing.gradedAt && ` · graded ${new Date(existing.gradedAt).toLocaleString()}`}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold tabular-nums text-green-900 ring-1 ring-inset ring-green-300">
              {existing.score}/{maxScore}
            </span>
          </div>
          {existing.feedback && (
            <div className="mt-3 rounded-md bg-white/70 p-3 text-sm text-ink">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Instructor feedback
              </p>
              <p className="mt-1 whitespace-pre-wrap">{existing.feedback}</p>
            </div>
          )}
        </div>
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink">
            <span className="inline-flex items-center gap-1.5">
              <Icon.Edit className="h-4 w-4" />
              Resubmit
            </span>
          </summary>
          <div className="border-t border-line p-4">
            <SubmissionFields
              formRef={formRef}
              content={content}
              setContent={setContent}
              attachments={attachments}
              setAttachments={setAttachments}
              onAddFile={onAddFile}
              onFiles={onFiles}
              uploadState={uploadState}
              dragOver={dragOver}
              setDragOver={setDragOver}
              error={error}
              pending={pending}
              onSubmit={onSubmit}
              submitLabel="Resubmit"
              maxScore={maxScore}
            />
          </div>
        </details>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">
            {submitted.updated ? "Submission updated." : "Submitted."}
          </p>
          <p className="mt-1 text-green-700">
            Your work has been recorded at {new Date(submitted.at).toLocaleTimeString()}.
            Your instructor will grade it soon.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSubmitted(null)}
          >
            <Icon.Edit className="h-4 w-4" />
            Edit again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SubmissionFields
      formRef={formRef}
      content={content}
      setContent={setContent}
      attachments={attachments}
      setAttachments={setAttachments}
      onAddFile={onAddFile}
      onFiles={onFiles}
      uploadState={uploadState}
      dragOver={dragOver}
      setDragOver={setDragOver}
      error={error}
      pending={pending}
      onSubmit={onSubmit}
      submitLabel={existing ? "Update submission" : "Submit assignment"}
      maxScore={maxScore}
    />
  );
}

// Internal — the form fields, reused between the "fresh submit" and
// the "resubmit" (inside <details>) layouts.
function SubmissionFields(props: {
  formRef: React.MutableRefObject<HTMLFormElement | null>;
  content: string;
  setContent: (v: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onAddFile: (f: File) => void;
  onFiles: (files: FileList | null) => void;
  uploadState: { status: string; error?: string };
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  maxScore: number;
}) {
  const {
    formRef,
    content,
    setContent,
    attachments,
    setAttachments,
    onFiles,
    uploadState,
    dragOver,
    setDragOver,
    error,
    pending,
    onSubmit,
    submitLabel,
    maxScore,
  } = props;

  const charsLeft = MAX_CHARS - content.length;
  const counterTone = charsLeft < 200 ? "text-amber-600" : charsLeft < 0 ? "text-red-600" : "text-ink-muted";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <Field
        label={`Your submission (max score: ${maxScore})`}
        name="content"
        hint="Describe your approach, then attach any files (PDF, image, code archive)."
      >
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          maxLength={MAX_CHARS}
          placeholder="Start writing your response…"
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-muted">
            Tip: press <kbd className="rounded border border-line bg-surface-dim px-1.5 py-0.5 font-mono text-[10px]">⌘/Ctrl + ↵</kbd> to submit.
          </span>
          <span className={`tabular-nums ${counterTone}`}>
            {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </Field>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink">
          Attachments <span className="text-ink-muted">({attachments.length}/{MAX_FILES})</span>
        </p>
        {attachments.length > 0 && (
          <ul className="mb-2 space-y-1">
            {attachments.map((a) => (
              <li
                key={a.key}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-dim px-3 py-1.5 text-xs"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 truncate text-brand-500 hover:underline"
                >
                  <Icon.File className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-ink-muted">
                    ({Math.ceil(a.size / 1024)} KB)
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.key !== a.key))
                  }
                  className="shrink-0 text-ink-muted hover:text-red-600"
                  aria-label={`Remove ${a.name}`}
                >
                  <Icon.Close className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label
          className={[
            "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm transition-colors",
            dragOver
              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10"
              : "border-line text-ink-muted hover:border-brand-500 hover:text-ink",
            uploadState.status === "uploading" || attachments.length >= MAX_FILES
              ? "pointer-events-none opacity-60"
              : "",
          ].join(" ")}
        >
          <Icon.Upload className="h-4 w-4" />
          {uploadState.status === "uploading"
            ? "Uploading…"
            : attachments.length >= MAX_FILES
              ? `Maximum ${MAX_FILES} files`
              : dragOver
                ? "Drop files to attach"
                : "Click or drop files to attach"}
          <input
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={(e) => {
              onFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          Up to {MAX_FILES} files, 50 MB each. PDF, images, docs, slides, zip.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-xs text-ink-muted">
          You can update your submission until the instructor grades it.
        </p>
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={uploadState.status === "uploading"}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
