// File upload — accepts a single multipart file, stores it via the
// storage adapter, returns the object key + signed URL.
//
// Auth: caller must be signed in (any role).
// Limits: 50MB per file for documents/images, 500MB for video
// (enforced again in storage.putObject).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { putObject } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

// Force the Node.js runtime — fs/buffer APIs aren't available on Edge.
export const runtime = "nodejs";

const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/markdown",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Video, for lesson recordings. Kept to container formats a browser
  // can play directly rather than anything that would need transcoding.
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const limited = await rateLimit(`upload:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type", type: file.type }, { status: 415 });
  }

  // Reject oversized uploads before buffering: a rejected 500 MB video
  // would otherwise be read fully into memory first. The authoritative
  // check still lives in putObject.
  const maxBytes = file.type.startsWith("video/") ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "too_large", maxBytes },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const obj = await putObject({
    filename: file.name || "upload",
    contentType: file.type,
    data: buf,
  });

  return NextResponse.json(obj, { status: 201 });
}
