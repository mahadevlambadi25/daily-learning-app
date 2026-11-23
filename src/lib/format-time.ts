/**
 * Timestamp formatting that is safe for server rendering.
 *
 * `toLocaleString()` without an explicit locale and time zone formats in whatever machine runs
 * it: UTC on the server, the viewer's zone in the browser. Rendering that on the server and
 * hydrating it in the browser produces different text (React error #418). The stable format
 * pins both, so server HTML and the first client render are identical everywhere; the local
 * format is only used after hydration.
 */

const STYLE = { dateStyle: "medium", timeStyle: "short" } as const;

export const STABLE_LOCALE = "en-US";
export const STABLE_TIME_ZONE = "UTC";

/** Identical on every machine, e.g. "Nov 23, 2026, 4:45 AM UTC". */
export function formatStableTimestamp(iso: string): string {
  return `${new Intl.DateTimeFormat(STABLE_LOCALE, { ...STYLE, timeZone: STABLE_TIME_ZONE }).format(new Date(iso))} UTC`;
}

/** The viewer's own time (browser locale and zone unless given), e.g. "Nov 23, 2026, 10:15 AM". */
export function formatLocalTimestamp(iso: string, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { ...STYLE, ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
}
