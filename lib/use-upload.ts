"use client";

// useUpload — uploads a File directly to Cloudinary.
//
// Two steps: fetch a signed ticket from our API, then POST the bytes
// straight to Cloudinary. The file never passes through a Next.js request
// body, so the 10MB ceiling isn't fighting the serverless platform's own
// body limit.
//
// The server mints the signature and pins `max_file_size` to it, so the
// size check here is a courtesy to the user, not the control.

import { useState, useCallback } from "react";
import {
  MAX_UPLOAD_LABEL,
  validateUpload,
} from "@/lib/upload-config";

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

type Ticket = {
  apiKey: string;
  uploadUrl: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  uploadPreset: string;
  key: string;
  url: string;
  maxFileSize: number;
};

// Server error codes mapped to something worth showing a user. Anything
// unrecognised falls back to the raw code rather than a blank message.
const ERROR_MESSAGES: Record<string, string> = {
  too_large: `That file is larger than ${MAX_UPLOAD_LABEL}.`,
  unsupported_type: "That file type isn't supported here.",
  empty: "That file is empty.",
  rate_limited: "Too many uploads — wait a moment and try again.",
  unauthenticated: "Your session expired. Sign in and try again.",
  storage_not_configured: "File uploads aren't configured on this deployment.",
  missing_file: "No file was received.",
  invalid_form_data: "The upload could not be read.",
  file_too_large: `That file is larger than ${MAX_UPLOAD_LABEL}.`,
  upload_failed: "The upload didn't complete. Try again.",
};

function describeUploadError(code: string, status: number): string {
  return ERROR_MESSAGES[code] ?? `Upload failed (${code || status})`;
}

export function useUpload() {
  const [state, setState] = useState<State>({ status: "idle" });

  const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
    // Fail before spending the user's bandwidth.
    const invalid = validateUpload(file.size, file.type);
    if (invalid) {
      setState({ status: "error", error: invalid.error });
      return null;
    }

    setState({ status: "uploading", progress: 0 });
    try {
      // The declared type is re-validated server-side; a wrong guess only
      // costs a rejected ticket, never a bypass.
      const ticketRes = await fetch(
        `/api/files/upload?type=${encodeURIComponent(file.type)}`,
      );
      if (!ticketRes.ok) {
        const err = (await ticketRes.json().catch(() => ({}))) as { error?: string };
        setState({ status: "error", error: describeUploadError(err.error ?? "", ticketRes.status) });
        return null;
      }
      const ticket = (await ticketRes.json()) as Ticket;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", ticket.apiKey);
      fd.append("timestamp", String(ticket.timestamp));
      fd.append("signature", ticket.signature);
      // Deliberately no `folder`: it would be prefixed onto the returned
      // public_id and no longer match the key we already signed a URL for.
      // Pinned by the signature: the asset is stored at exactly this key.
      fd.append("public_id", ticket.publicId);
      // Signed, so it can't be swapped for a laxer preset or dropped.
      if (ticket.uploadPreset) fd.append("upload_preset", ticket.uploadPreset);
      // Not part of the digest — Cloudinary excludes it. Harmless to send
      // and it enforces the ceiling for an honest client; the preset is
      // what makes it unbypassable.
      fd.append("max_file_size", String(ticket.maxFileSize));

      // XHR rather than fetch: this is the one upload path that can report
      // real progress, and every attachment field in the app shows a
      // progress bar.
      const json = await new Promise<CloudinaryResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", ticket.uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({
              status: "uploading",
              progress: Math.round((e.loaded / e.total) * 100),
            });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as CloudinaryResponse);
            } catch {
              reject(new Error("Upload failed (bad response)"));
            }
          } else {
            let code = "upload_failed";
            try {
              const parsed = JSON.parse(xhr.responseText) as {
                error?: { message?: string };
              };
              if (parsed.error?.message) code = parsed.error.message;
            } catch {
              /* keep the default code */
            }
            reject(new Error(describeUploadError(code, xhr.status)));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed (network)"));
        xhr.send(fd);
      });

      // Trust the ticket's key over the echoed public_id: the signature
      // pins it, and the download URL was already minted for it.
      if (json.public_id !== ticket.publicId) {
        setState({ status: "error", error: "Upload stored at an unexpected location." });
        return null;
      }

      const result: UploadResult = {
        key: ticket.key,
        url: ticket.url,
        size: json.bytes ?? file.size,
        contentType: file.type,
        sha256: "",
      };
      setState({ status: "done", result });
      return result;
    } catch (e) {
      setState({
        status: "error",
        error: e instanceof Error ? e.message : "Upload failed",
      });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, upload, reset };
}

type CloudinaryResponse = {
  public_id: string;
  bytes?: number;
};
