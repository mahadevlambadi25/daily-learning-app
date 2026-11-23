export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Daylight";
export const APP_TAGLINE = "A short lesson a day on the things you care about.";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DELIVERY_TIMES = ["07:00", "08:00", "12:00", "18:00"] as const;
export const MAX_TOPICS = 5;
export const MIN_TOPICS = 1;
export const WORDS_PER_MINUTE = 200;
export const SESSION_COOKIE = "dl_session";
export const SESSION_TTL_DAYS = 30;

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function supportEmail(): string {
  return process.env.SUPPORT_EMAIL || "support@example.com";
}
