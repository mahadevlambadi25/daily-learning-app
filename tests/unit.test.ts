import { describe, expect, it } from "vitest";
import { addDays, friendlyDate, isValidTimezone, localDate, localTime, safeTimezone } from "@/lib/time";
import { estimateReadTime, parseBody, speechSegments, wordCount } from "@/lib/lesson-content";
import { allowedActions, nextStatus, publishIssues } from "@/lib/lesson-workflow";
import { lessonInputSchema, profileUpdateSchema, signupSchema, topicSelectionSchema } from "@/lib/validation";
import { computeStreak } from "@/server/lessons";
import { dailyDigestEmail } from "@/server/email";

describe("time", () => {
  const instant = new Date("2026-11-21T20:00:00Z");

  it("computes local dates per timezone", () => {
    expect(localDate("Asia/Kolkata", instant)).toBe("2026-11-22"); // 01:30 IST next day
    expect(localDate("America/New_York", instant)).toBe("2026-11-21");
    expect(localTime("Asia/Kolkata", instant)).toBe("01:30");
    expect(localTime("UTC", instant)).toBe("20:00");
  });

  it("validates IANA timezones and falls back to Asia/Kolkata", () => {
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(safeTimezone("nope")).toBe("Asia/Kolkata");
    expect(safeTimezone(null)).toBe("Asia/Kolkata");
  });

  it("does calendar arithmetic across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("formats a friendly date", () => {
    expect(friendlyDate("2026-11-21")).toBe("Saturday 21 November");
  });
});

describe("lesson content", () => {
  it("parses paragraphs and bullet lists without HTML", () => {
    const blocks = parseBody("First para\nstill first.\n\n- one\n- two\n\n<script>x</script>");
    expect(blocks).toEqual([
      { type: "p", text: "First para still first." },
      { type: "ul", items: ["one", "two"] },
      { type: "p", text: "<script>x</script>" }, // rendered as text, never as HTML
    ]);
  });

  it("estimates read time at 200 wpm with a 1 minute minimum", () => {
    expect(wordCount("  a b  c ")).toBe(3);
    expect(estimateReadTime("short")).toBe(1);
    expect(estimateReadTime(Array(600).fill("w").join(" "))).toBe(3);
  });

  it("builds the read-aloud script from lesson content only", () => {
    const { segments, takeawayStart, hookIndex, bodyStart } = speechSegments({ title: "T", body: "P1\n\n- a", takeaways: ["x", "y", "z"], actionText: "Do" });
    expect(segments).toEqual(["T", "P1", "a", "Key takeaways", "x", "y", "z", "Try this today", "Do"]);
    expect(segments[takeawayStart]).toBe("Key takeaways");
    expect(hookIndex).toBe(-1);
    expect(bodyStart).toBe(1);
    const withHook = speechSegments({ title: "T", hook: "H", body: "P1", takeaways: [], actionText: "Do" });
    expect(withHook.segments.slice(0, 3)).toEqual(["T", "H", "P1"]);
    expect(withHook.hookIndex).toBe(1);
    expect(withHook.bodyStart).toBe(2);
  });
});

describe("editorial workflow", () => {
  it("only allows PRD transitions", () => {
    expect(nextStatus("draft", "submit")).toBe("in_review");
    expect(nextStatus("draft", "approve_publish")).toBeNull();
    expect(nextStatus("in_review", "approve_schedule")).toBe("scheduled");
    expect(nextStatus("published", "unpublish")).toBe("draft");
    expect(nextStatus("archived", "restore")).toBe("draft");
    expect(allowedActions("scheduled")).toEqual(["reschedule", "cancel_schedule"]);
  });

  const complete = {
    topicId: "t",
    title: "T",
    hook: "H",
    body: Array(200).fill("w").join(" "),
    takeaway1: "a",
    takeaway2: "b",
    takeaway3: "c",
    actionText: "do",
    rightsBasis: "original",
    requiresSources: true,
    sourcesCount: 1,
  };

  it("blocks publishing without rights basis or sources", () => {
    expect(publishIssues(complete).errors).toEqual([]);
    expect(publishIssues({ ...complete, rightsBasis: null }).errors[0]).toMatch(/Rights basis/);
    expect(publishIssues({ ...complete, sourcesCount: 0 }).errors[0]).toMatch(/Sources/);
    expect(publishIssues({ ...complete, sourcesCount: 0, requiresSources: false }).errors).toEqual([]);
    expect(publishIssues({ ...complete, takeaway3: " " }).errors[0]).toMatch(/3 key takeaways/);
  });

  it("warns (not blocks) when the body is outside 150-250 words", () => {
    const r = publishIssues({ ...complete, body: "too short" });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/2 words/);
  });
});

describe("validation", () => {
  it("rejects zero and six-plus topic selections", () => {
    expect(topicSelectionSchema.safeParse({ topicIds: [] }).success).toBe(false);
    expect(topicSelectionSchema.safeParse({ topicIds: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(topicSelectionSchema.safeParse({ topicIds: ["1", "1"] }).success).toBe(false);
    expect(topicSelectionSchema.safeParse({ topicIds: ["1", "2", "3", "4", "5"] }).success).toBe(true);
  });

  it("validates sign-up input and requires accepting terms", () => {
    expect(signupSchema.safeParse({ email: "A@B.co", password: "longenough", acceptTerms: true }).data?.email).toBe("a@b.co");
    expect(signupSchema.safeParse({ email: "bad", password: "longenough", acceptTerms: true }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "short", acceptTerms: true }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "longenough" }).success).toBe(false);
  });

  it("validates timezone and delivery time on profile updates", () => {
    expect(profileUpdateSchema.safeParse({ timezone: "Asia/Kolkata", preferredDeliveryTime: "08:00" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ timezone: "Nowhere/City" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ preferredDeliveryTime: "09:13" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ userId: "someone-else" }).success).toBe(false); // strict
  });

  it("enforces lesson field limits", () => {
    const base = { topicId: "t", title: "x" };
    expect(lessonInputSchema.safeParse(base).success).toBe(true);
    expect(lessonInputSchema.safeParse({ ...base, title: "x".repeat(91) }).success).toBe(false);
    expect(lessonInputSchema.safeParse({ ...base, hook: "x".repeat(301) }).success).toBe(false);
    expect(lessonInputSchema.safeParse({ ...base, takeaways: ["a", "b"] }).success).toBe(false);
    expect(lessonInputSchema.safeParse({ ...base, takeaways: ["a", "b", "x".repeat(161)] }).success).toBe(false);
    expect(lessonInputSchema.safeParse({ ...base, actionText: "x".repeat(501) }).success).toBe(false);
  });
});

describe("streak", () => {
  const now = new Date("2026-11-21T10:00:00Z"); // 15:30 IST
  const d = (iso: string) => new Date(iso);

  it("counts consecutive local days ending today", () => {
    expect(computeStreak([d("2026-11-21T05:00:00Z"), d("2026-11-20T05:00:00Z"), d("2026-11-19T05:00:00Z")], "Asia/Kolkata", now)).toBe(3);
  });

  it("keeps yesterday's streak alive until today ends", () => {
    expect(computeStreak([d("2026-11-20T05:00:00Z"), d("2026-11-19T05:00:00Z")], "Asia/Kolkata", now)).toBe(2);
  });

  it("breaks on a missed day and uses the user's timezone", () => {
    expect(computeStreak([d("2026-11-21T05:00:00Z"), d("2026-11-19T05:00:00Z")], "Asia/Kolkata", now)).toBe(1);
    // 2026-11-20T20:00Z is already 21 Nov in Kolkata -> counts as today.
    expect(computeStreak([d("2026-11-20T20:00:00Z")], "Asia/Kolkata", now)).toBe(1);
    expect(computeStreak([], "Asia/Kolkata", now)).toBe(0);
  });
});

describe("daily digest email", () => {
  it("includes hooks, deep links and unsubscribe, not the full lesson, and escapes HTML", () => {
    const m = dailyDigestEmail({
      to: "a@b.co",
      name: "<b>Ann</b>",
      unsubscribeToken: "tok",
      lessons: [{ id: "L1", title: "Title & more", hook: "Hook", topicName: "Topic" }],
    });
    expect(m.html).toContain("/lessons/L1");
    expect(m.html).toContain("/unsubscribe?token=tok");
    expect(m.html).toContain("&lt;b&gt;Ann");
    expect(m.html).toContain("Title &amp; more");
    expect(m.headers?.["List-Unsubscribe"]).toContain("/unsubscribe?token=tok");
    expect(m.text).toContain("Unsubscribe:");
  });
});
