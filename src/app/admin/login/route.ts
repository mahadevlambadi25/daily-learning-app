import { NextResponse } from "next/server";

/**
 * There is one sign-in page for everyone (/login). People naturally try /admin/login,
 * so forward them there and come back to the admin console afterwards.
 * (A route handler is used because it isn't wrapped by the admin layout's role check.)
 */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/login?next=/admin", req.url));
}
