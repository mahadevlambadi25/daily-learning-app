import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { formatLocalTimestamp, formatStableTimestamp } from "@/lib/format-time";
import { LocalTime } from "@/components/local-time";

// Regression for React error #418 on the admin Edit Lesson page: change-history timestamps were
// formatted with the running machine's time zone, so the server (UTC on Vercel) and the
// browser (e.g. India) rendered different text during hydration.

const ISO = "2026-11-23T04:45:00.000Z"; // 10:15 AM in India, 8:45 PM the day before in Los Angeles
const ZONES = ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Kiritimati"];
const originalTz = process.env.TZ;

/** Runs `fn` as if on a machine in `zone` (Node re-reads TZ when it changes). */
function inZone<T>(zone: string, fn: () => T): T {
  process.env.TZ = zone;
  return fn();
}

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("hydration-safe timestamps", () => {
  it("the old formatting really differs between server and browser zones (the bug)", () => {
    const old = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    expect(inZone("UTC", () => old(ISO))).not.toBe(inZone("Asia/Kolkata", () => old(ISO)));
  });

  it("stable format is identical in every machine time zone", () => {
    const outputs = ZONES.map((z) => inZone(z, () => formatStableTimestamp(ISO)));
    expect(new Set(outputs).size).toBe(1);
    expect(outputs[0]).toBe("Nov 23, 2026, 4:45 AM UTC");
  });

  it("server HTML and the first client render match across time zones", () => {
    // renderToString uses the server snapshot of useSyncExternalStore, which is exactly what
    // React also uses for the first client render while hydrating. So rendering under a
    // "server" zone and a "browser" zone must give the same markup.
    const render = () => renderToString(createElement(LocalTime, { iso: ISO, className: "text-muted" }));
    const server = inZone("UTC", render);
    for (const browserZone of ZONES) expect(inZone(browserZone, render)).toBe(server);
    expect(server).toContain('dateTime="2026-11-23T04:45:00.000Z"');
    expect(server).toContain("Nov 23, 2026, 4:45 AM UTC");
  });

  it("after hydration the viewer sees their own local time", () => {
    expect(formatLocalTimestamp(ISO, "en-US", "Asia/Kolkata")).toBe("Nov 23, 2026, 10:15 AM");
    expect(formatLocalTimestamp(ISO, "en-US", "America/Los_Angeles")).toBe("Nov 22, 2026, 8:45 PM");
    expect(formatLocalTimestamp(ISO, "en-GB", "Asia/Kolkata")).toBe("23 Nov 2026, 10:15");
  });
});
