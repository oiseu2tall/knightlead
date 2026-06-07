// File download — verifies signed token, streams the object.
// Anyone with a valid token can fetch; tokens are HMAC-signed and expire.
//
// Path layout: /api/files/download/<key>?t=<token>
// We base64url-encode the key in the URL so '/' inside the key is safe.

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

  return new NextResponse(new Uint8Array(obj.data), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Content-Length": String(obj.data.byteLength),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
