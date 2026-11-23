/** Only same-site relative paths are allowed as ?next= targets (prevents open redirects). */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

/** Where a signed-in user lands when no ?next= is given. */
export function homeFor(user: { isAdmin: boolean; onboarded: boolean }): string {
  if (user.isAdmin) return "/admin";
  return user.onboarded ? "/today" : "/onboarding/topics";
}
