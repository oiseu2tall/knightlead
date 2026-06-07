// Next.js 16 — `middleware` was renamed to `proxy`.
// We use the Auth.js v5 `auth` export as the proxy function so it
// automatically populates req.auth and runs the `authorized` callback.

import { auth } from "@/auth";
import { NextResponse } from "next/server";

// `/admin/**` is shared by ADMIN (full) and MANAGER (catalog only).
// Per-action / per-page checks decide what each role can actually do.
const ADMIN_OR_MANAGER = new Set(["ADMIN", "MANAGER"]);
const INSTRUCTOR_LIKE  = new Set(["INSTRUCTOR", "ADMIN"]);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;

  // The `authorized` callback already handled the "is logged in" check.
  // Here we add role-based gating for protected sections.
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isInstructorRoute = nextUrl.pathname.startsWith("/instructor");

  if (isAdminRoute && (!role || !ADMIN_OR_MANAGER.has(role))) {
    const url = nextUrl.clone();
    url.pathname = "/forbidden";
    return NextResponse.rewrite(url);
  }

  if (isInstructorRoute && (!role || !INSTRUCTOR_LIKE.has(role))) {
    const url = nextUrl.clone();
    url.pathname = "/forbidden";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
});

// Match all routes EXCEPT static assets, image optimizer, and Auth.js itself.
// Negative lookahead excludes: api, _next/static, _next/image, favicon, common files.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
