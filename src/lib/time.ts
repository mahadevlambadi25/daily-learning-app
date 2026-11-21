import { DEFAULT_TIMEZONE } from "./config";

/** Returns true if `tz` is a valid IANA timezone identifier. */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** Local calendar date (YYYY-MM-DD) for `date` in timezone `tz`. */
export function localDate(tz: string, date: Date = new Date()): string {
  const p = parts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Local wall-clock time (HH:mm, 24h) for `date` in timezone `tz`. */
export function localTime(tz: string, date: Date = new Date()): string {
  const p = parts(date, tz);
  return `${p.hour}:${p.minute}`;
}

/** Adds `days` to a YYYY-MM-DD string (calendar arithmetic, timezone-free). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** "Saturday, 21 November" style label for a YYYY-MM-DD date. */
export function friendlyDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDate(date: Date | string | null | undefined, tz?: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz ? safeTimezone(tz) : undefined,
  }).format(new Date(date));
}

/** Greeting that matches the user's local time of day. */
export function greeting(tz: string, date: Date = new Date()): string {
  const hour = Number(localTime(tz, date).slice(0, 2));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
