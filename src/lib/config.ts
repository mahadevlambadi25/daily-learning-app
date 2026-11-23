export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Daylight";
export const APP_TAGLINE = "A short lesson a day on the things you care about.";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DELIVERY_TIMES = ["07:00", "08:00", "12:00", "18:00"] as const;
export const MAX_TOPICS = 5;
export const MIN_TOPICS = 1;
export const WORDS_PER_MINUTE = 200;
export const SESSION_COOKIE = "dl_session";
// Session lifetimes (learner 30 days, admin 24 hours) live in src/lib/auth/policy.ts.

/** Absolute base URL for links in emails. On Vercel it falls back to the production domain. */
export function appUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}

export function supportEmail(): string {
  return process.env.SUPPORT_EMAIL || "support@example.com";
}
