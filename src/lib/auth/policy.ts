/**
 * Authentication policy: session lifetimes and password rules. Pure functions (no I/O) so they
 * can be unit-tested and shared by the session layer, services and forms.
 */

export const LEARNER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (unchanged)
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function sessionTtlMs(isAdmin: boolean): number {
  return isAdmin ? ADMIN_SESSION_TTL_MS : LEARNER_SESSION_TTL_MS;
}

/**
 * A session is valid until the earlier of its stored expiry and createdAt + the role's limit.
 * Checking the role at read time caps sessions created before this policy existed and sessions
 * of users who were promoted to admin after signing in.
 */
export function sessionExpiresAt(session: { createdAt: Date; expiresAt: Date }, isAdmin: boolean): Date {
  const roleLimit = session.createdAt.getTime() + sessionTtlMs(isAdmin);
  return new Date(Math.min(session.expiresAt.getTime(), roleLimit));
}

export function isSessionActive(session: { createdAt: Date; expiresAt: Date }, isAdmin: boolean, now: Date = new Date()): boolean {
  return sessionExpiresAt(session, isAdmin) > now;
}

// ---- Passwords -------------------------------------------------------------------

export const PASSWORD_MAX = 128;
export const LEARNER_PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MIN = 12;

// A short deny-list of the most common choices; length + this list covers the usual guesses.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "qwerty", "qwerty123", "qwertyuiop",
  "letmein", "welcome", "welcome1", "welcome123", "admin", "admin123", "admin1234", "administrator", "iloveyou",
  "123456", "1234567", "12345678", "123456789", "1234567890", "123123", "111111", "000000", "abc123", "monkey",
  "dragon", "sunshine", "football", "baseball", "changeme", "changeme123", "changeme123!", "daylight", "daylight123",
]);

/**
 * Returns a list of problems (empty = acceptable). Admins need 12+ characters; everyone else 8+.
 * Rejects common passwords and passwords containing the email name.
 */
export function passwordProblems(password: string, opts: { email: string; isAdmin: boolean }): string[] {
  const problems: string[] = [];
  const min = opts.isAdmin ? ADMIN_PASSWORD_MIN : LEARNER_PASSWORD_MIN;
  if (password.length < min) problems.push(`Use at least ${min} characters.`);
  if (password.length > PASSWORD_MAX) problems.push(`Use at most ${PASSWORD_MAX} characters.`);
  if (password.trim() !== password) problems.push("Don't start or end with a space.");
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) problems.push("That password is too common. Pick something less guessable.");
  const name = opts.email.split("@")[0]?.toLowerCase() ?? "";
  if (name.length >= 4 && lower.includes(name)) problems.push("Don't include your email name in the password.");
  if (/^(.)\1+$/.test(password)) problems.push("Don't repeat a single character.");
  return problems;
}
