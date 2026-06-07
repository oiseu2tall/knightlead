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
        setState({ status: "error", error: err.error ?? `HTTP ${res.status}` });
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
