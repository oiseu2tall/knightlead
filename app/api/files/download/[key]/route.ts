// File download — verifies signed token, then streams the object from
// Cloudinary. Anyone with a valid token can fetch; tokens are HMAC-signed
// and expire.
//
// Path layout: /api/files/download/<key>?t=<token>[&dl=1]
// The key is `<resourceType>/<publicId>`, and is URL-encoded so the '/'
// separators are safe. `dl=1` forces a save-as instead of inline
// rendering, for callers that want a real file rather than a browser tab.

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

  // Streaming rather than redirecting keeps the HMAC token the only way
  // in: a Cloudinary delivery URL handed to a browser would be a
  // permanent, unexpiring link to the original file.
  let obj: Awaited<ReturnType<typeof getObject>>;
  try {
    obj = await getObject(key);
  } catch (e) {
    console.error("[files] download failed:", e);
    return NextResponse.json({ error: "storage_error" }, { status: 502 });
  }
  if (!obj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const download = _req.nextUrl.searchParams.get("dl") === "1";
  const headers: Record<string, string> = {
    "Content-Type": obj.contentType,
    "Content-Length": String(obj.data.byteLength),
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
  if (download) {
    headers["Content-Disposition"] =
      `attachment; filename="${safeFilename(key, obj.format)}"`;
  }

  return new NextResponse(new Uint8Array(obj.data), { status: 200, headers });
}

// Header values must not contain quotes, newlines, or non-ASCII — the
// object key is server-generated, but sanitise anyway so a future key
// format can't inject header content. Cloudinary public ids carry no
// extension, so the format reported by the asset metadata is appended;
// without it a downloaded PDF would land on disk with no name at all.
function safeFilename(key: string, format: string): string {
  const base = key.split("/").pop() ?? "download";
  const withExt = format ? `${base}.${format}` : base;
  return withExt.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "download";
}
