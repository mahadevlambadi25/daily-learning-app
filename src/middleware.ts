import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "dl_session";
const PROTECTED_PREFIXES = ["/today", "/lessons", "/library", "/settings", "/onboarding", "/admin", "/topics"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Called by cron or by mail providers (one-click unsubscribe), not by the browser app.
const CSRF_EXEMPT = ["/api/jobs/", "/api/unsubscribe"];

/**
 * Edge guard. Cheap checks only: real authorization happens server-side on every
 * page/route (session lookup + role check).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence-in-depth (cookies are also SameSite=Lax): browser writes must be same-origin.
  if (pathname.startsWith("/api/") && MUTATING.has(req.method) && !CSRF_EXEMPT.some((p) => pathname.startsWith(p))) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ data: null, error: { code: "forbidden", message: "Cross-origin request blocked." } }, { status: 403 });
    }
  }

  // /admin/login is a public alias that forwards to /login?next=/admin (see app/admin/login/route.ts).
  if (pathname !== "/admin/login" && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)"],
};
