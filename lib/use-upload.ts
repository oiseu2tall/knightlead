"use client";

// useUpload — tiny client hook that POSTs a File to /api/files/upload
// and returns the stored object. Used by the assignment-submission form.

import { useState, useCallback } from "react";

type UploadResult = {
  key: string;
  url: string;
  size: number;
  contentType: string;
  sha256: string;
};

type State =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "done"; result: UploadResult }
  | { status: "error"; error: string };

// Server error codes mapped to something worth showing a user. Anything
// unrecognised falls back to the raw code rather than a blank message.
const ERROR_MESSAGES: Record<string, string> = {
  too_large: "That file is too large to upload.",
  unsupported_type: "That file type isn't supported here.",
  rate_limited: "Too many uploads — wait a moment and try again.",
  unauthenticated: "Your session expired. Sign in and try again.",
  missing_file: "No file was received.",
  invalid_form_data: "The upload could not be read.",
};

function describeUploadError(code: string, status: number): string {
  return ERROR_MESSAGES[code] ?? `Upload failed (${code || status})`;
}

export function useUpload() {
  const [state, setState] = useState<State>({ status: "idle" });

  const upload = useCallback(async (file: File) => {
    setState({ status: "uploading", progress: 0 });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ status: "error", error: describeUploadError(err.error ?? "", res.status) });
        return null;
      }
      const result = (await res.json()) as UploadResult;
      setState({ status: "done", result });
      return result;
    } catch (e) {
      setState({ status: "error", error: (e as Error).message });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, upload, reset };
}
