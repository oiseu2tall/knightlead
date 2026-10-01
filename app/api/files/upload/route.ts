// Issues a single-upload authorisation for Cloudinary.
//
// The file itself does NOT come through here. Serverless hosts cap request
// bodies at ~4.5MB, so proxying a 10MB upload would work locally and fail
// in production. Instead the browser POSTs the file straight to Cloudinary
// with the signature returned here.
//
// The signed payload pins the size ceiling, so the client cannot raise its
// own limit; Cloudinary rejects anything over it.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUploadTicket, isStorageConfigured } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedUploadType } from "@/lib/upload-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const limited = await rateLimit(`upload:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  // The client declares the type so the server can derive the Cloudinary
  // resource type and therefore the final object key. It is re-validated
  // here and again by the signature, so a lie is rejected rather than
  // trusted — the worst a wrong answer can do is earn a useless ticket.
  const contentType = req.nextUrl.searchParams.get("type") ?? "";
  if (!isAllowedUploadType(contentType)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  try {
    return NextResponse.json(createUploadTicket(contentType));
  } catch (e) {
    return NextResponse.json(
      { error: "storage_not_configured", detail: (e as Error).message },
      { status: 503 },
    );
  }
}
