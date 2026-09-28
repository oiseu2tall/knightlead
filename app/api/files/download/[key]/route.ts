// File download — verifies signed token, streams the object.
// Anyone with a valid token can fetch; tokens are HMAC-signed and expire.
//
// Path layout: /api/files/download/<key>?t=<token>[&dl=1]
// We base64url-encode the key in the URL so '/' inside the key is safe.
// `dl=1` forces a save-as instead of inline rendering, for callers that
// want a real file on disk rather than a browser tab.

import { NextRequest, NextResponse } from "next/server";
import { getObject, verifyToken } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> },
) {
  // Next 16: params is a Promise — must await.
  const { key: encodedKey } = await ctx.params;
  const key = decodeURIComponent(encodedKey);
  const token = _req.nextUrl.searchParams.get("t");

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  let verified;
  try {
    verified = verifyToken(token);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  // Token must match the requested key — prevent token-for-different-file reuse.
  if (verified.key !== key) {
    return NextResponse.json({ error: "key_mismatch" }, { status: 401 });
  }

  // Per-key rate limit (e.g. scraping attempts).
  const limited = await rateLimit(`dl:${key}`, { limit: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const obj = await getObject(key);
  if (!obj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The local storage adapter doesn't retain the upload's content type, so
  // it always reports octet-stream. Combined with nosniff below that forces
  // every "View" click to save the file instead of rendering it, so fall
  // back to the extension — which is whitelisted at upload time.
  const contentType = obj.contentType === "application/octet-stream"
    ? contentTypeForKey(key)
    : obj.contentType;

  const download = _req.nextUrl.searchParams.get("dl") === "1";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(obj.data.byteLength),
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${safeFilename(key)}"`;
  }

  return new NextResponse(new Uint8Array(obj.data), { status: 200, headers });
}

// Types we can safely let a browser render inline. Anything else stays
// octet-stream so an unknown/hostile type is never executed in our origin.
const INLINE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  mov: "video/quicktime",
};

function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return INLINE_TYPES[ext] ?? "application/octet-stream";
}

// Header values must not contain quotes, newlines, or non-ASCII — the
// object key is server-generated, but sanitise anyway so a future key
// format can't inject header content.
function safeFilename(key: string): string {
  const name = key.split("/").pop() ?? "download";
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "download";
}
