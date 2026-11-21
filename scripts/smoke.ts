/**
 * End-to-end smoke test against a running server (PRD §19 Definition of Done).
 *   npm run build && npm start      (in one terminal)
 *   npm run test:smoke               (in another; BASE_URL defaults to http://localhost:3000)
 * Creates throwaway learner accounts and deletes them at the end.
 */
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync(".env", "utf8").match(new RegExp(`^${name}="?([^"\\n]*)"?`, "m"));
    return m?.[1];
  } catch {
    return undefined;
  }
}

class Client {
  cookie = "";
  constructor(public name: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        Origin: BASE,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("dl_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html or empty */
    }
    return { status: res.status, json, text, location: res.headers.get("location") };
  }
}

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);
  const stamp = Date.now();
  const anon = new Client("anon");
  const a = new Client("learner-a");
  const b = new Client("learner-b");
  const admin = new Client("admin");

  console.log("Public & routing");
  check("landing page renders", (await anon.req("GET", "/")).status === 200);
  const topics = await anon.req("GET", "/api/topics");
  check("50 active topics", topics.json?.data?.length === 50, topics.json?.meta);
  check("10 featured topics", topics.json?.meta?.featured === 10);
  const featured = topics.json.data.filter((t: any) => t.isFeatured);
  check("first featured is Personal Finance", featured[0]?.slug === "personal-finance-budgeting", featured[0]?.slug);
  const redirect = await anon.req("GET", "/today");
  check("protected page redirects to login", redirect.status === 307 && !!redirect.location?.includes("/login"), redirect.status);
  check("API requires auth (401)", (await anon.req("GET", "/api/me")).status === 401);
  for (const p of ["/terms", "/privacy", "/disclaimer", "/manifest.webmanifest"]) check(`${p} available`, (await anon.req("GET", p)).status === 200);

  console.log("\nSign-up & onboarding");
  const signup = await a.req("POST", "/api/auth/signup", { email: `smoke-a-${stamp}@example.com`, password: "smokepass123", acceptTerms: true, timezone: "Asia/Kolkata" });
  check("sign-up creates account (201)", signup.status === 201, signup.json);
  check("session cookie set", a.cookie.startsWith("dl_session="));
  const dup = await anon.req("POST", "/api/auth/signup", { email: `smoke-a-${stamp}@example.com`, password: "smokepass123", acceptTerms: true });
  check("duplicate email rejected (409)", dup.status === 409);
  check("weak password rejected (400)", (await anon.req("POST", "/api/auth/signup", { email: `x-${stamp}@example.com`, password: "short", acceptTerms: true })).status === 400);
  const me = await a.req("GET", "/api/me");
  check("profile defaults: email off, 07:00", me.json?.data?.emailDailyEnabled === false && me.json?.data?.preferredDeliveryTime === "07:00");
  check("not onboarded yet → /today redirects to onboarding", (await a.req("GET", "/today")).location?.includes("/onboarding/topics") ?? false);

  const ids = featured.map((t: any) => t.id);
  check("zero topics rejected (400)", (await a.req("PUT", "/api/me/topics", { topicIds: [] })).status === 400);
  check("six topics rejected (400)", (await a.req("PUT", "/api/me/topics", { topicIds: ids.slice(0, 6) })).status === 400);
  check("unknown topic rejected (400)", (await a.req("PUT", "/api/me/topics", { topicIds: ["nope"] })).status === 400);
  const put = await a.req("PUT", "/api/me/topics", { topicIds: ids.slice(0, 3) });
  check("three topics saved", put.status === 200 && put.json.data.length === 3);
  check("invalid timezone rejected (400)", (await a.req("PATCH", "/api/me", { timezone: "Mars/Olympus" })).status === 400);
  check("cannot set fields outside the schema (400)", (await a.req("PATCH", "/api/me", { email: "hijack@example.com" })).status === 400);
  const prefs = await a.req("PATCH", "/api/me", { timezone: "Europe/London", preferredDeliveryTime: "08:00", emailDailyEnabled: true, completeOnboarding: true });
  check("preferences saved + onboarding completed", prefs.status === 200 && prefs.json.data.timezone === "Europe/London" && !!prefs.json.data.onboardedAt);

  console.log("\nToday feed & lessons");
  const today = await a.req("GET", "/api/today");
  check("starter feed has one lesson per topic", today.json?.data?.length === 3, today.json?.data?.length);
  check("feed uses the user's local date", /^\d{4}-\d{2}-\d{2}$/.test(today.json?.meta?.localDate));
  const again = await a.req("GET", "/api/today");
  check("feed is stable on reload", JSON.stringify(again.json.data.map((i: any) => i.lesson.id)) === JSON.stringify(today.json.data.map((i: any) => i.lesson.id)));
  check("Today page renders", (await a.req("GET", "/today")).status === 200);
  const lessonId = today.json.data[0].lesson.id;
  const lesson = await a.req("GET", `/api/lessons/${lessonId}`);
  check("lesson has body, 3 takeaways, action, sources", !!lesson.json?.data?.body && lesson.json.data.takeaways.length === 3 && !!lesson.json.data.actionText && lesson.json.data.sources.length > 0);
  check("quiz answers not exposed", !lesson.text.includes("correctOption") && !lesson.text.includes("explanation"));
  check("lesson page renders", (await a.req("GET", `/lessons/${lessonId}`)).status === 200);

  check("bookmark created (201)", (await a.req("POST", `/api/lessons/${lessonId}/bookmark`)).status === 201);
  check("bookmark idempotent (200)", (await a.req("POST", `/api/lessons/${lessonId}/bookmark`)).status === 200);
  const done = await a.req("POST", `/api/lessons/${lessonId}/progress`, { status: "completed" });
  check("lesson completed", done.json?.data?.status === "completed");
  const saved = await a.req("GET", "/api/me/library?filter=saved");
  const completedLib = await a.req("GET", "/api/me/library?filter=completed");
  check("library shows saved + completed", saved.json.data.length === 1 && completedLib.json.data.length === 1);
  if (lesson.json.data.questions.length) {
    const answers = Object.fromEntries(lesson.json.data.questions.map((q: any) => [q.id, "a"]));
    const quiz = await a.req("POST", `/api/lessons/${lessonId}/quiz`, { answers });
    check("quiz scored server-side with feedback", quiz.status === 200 && typeof quiz.json.data.score === "number" && !!quiz.json.data.results[0].explanation);
  }
  check("library & settings pages render", (await a.req("GET", "/library")).status === 200 && (await a.req("GET", "/settings")).status === 200);

  console.log("\nData isolation & security");
  await b.req("POST", "/api/auth/signup", { email: `smoke-b-${stamp}@example.com`, password: "smokepass123", acceptTerms: true });
  await b.req("DELETE", `/api/lessons/${lessonId}/bookmark`);
  check("user B cannot remove user A's bookmark", (await a.req("GET", "/api/me/library?filter=saved")).json.data.length === 1);
  check("user B library is empty", (await b.req("GET", "/api/me/library?filter=saved")).json.data.length === 0);
  check("learner cannot access admin API (403)", (await a.req("GET", "/api/admin/lessons")).status === 403);
  check("learner admin page redirects", (await a.req("GET", "/admin")).status === 307);
  const csrf = await a.req("POST", `/api/lessons/${lessonId}/bookmark`, undefined, { Origin: "https://evil.example" });
  check("cross-origin write blocked (403)", csrf.status === 403);
  check("forgot-password does not reveal accounts", (await anon.req("POST", "/api/auth/forgot-password", { email: `nobody-${stamp}@example.com` })).status === 200);

  console.log("\nAdmin CMS workflow");
  const adminEmail = env("SEED_ADMIN_EMAIL");
  const adminPass = env("SEED_ADMIN_PASSWORD");
  const login = await admin.req("POST", "/api/auth/login", { email: adminEmail, password: adminPass });
  check("admin signs in", login.status === 200, login.json);
  check("admin list loads", (await admin.req("GET", "/api/admin/lessons?status=published")).json?.meta?.total >= 50);
  const created = await admin.req("POST", "/api/admin/lessons", {
    topicId: ids[0],
    title: `Smoke test lesson ${stamp}`,
    hook: "Why this matters.",
    body: Array(170).fill("word").join(" "),
    takeaways: ["One", "Two", "Three"],
    actionText: "Try it.",
    rightsBasis: null,
  });
  check("draft created (201)", created.status === 201 && created.json.data.status === "draft");
  const draftId = created.json.data.id;
  check("learner cannot read drafts (404)", (await a.req("GET", `/api/lessons/${draftId}`)).status === 404);
  check("publish blocked from draft (409)", (await admin.req("POST", `/api/admin/lessons/${draftId}/publish`)).status === 409);
  const submitNoRights = await admin.req("POST", `/api/admin/lessons/${draftId}/status`, { action: "submit" });
  check("submit blocked without rights basis/sources (400)", submitNoRights.status === 400, submitNoRights.json?.error);
  const full = {
    topicId: ids[0],
    title: `Smoke test lesson ${stamp}`,
    hook: "Why this matters.",
    body: Array(170).fill("word").join(" "),
    takeaways: ["One", "Two", "Three"],
    actionText: "Try it.",
    rightsBasis: "original",
    sources: [{ sourceTitle: "Example", sourceUrl: "https://example.org" }],
  };
  check("draft updated", (await admin.req("PATCH", `/api/admin/lessons/${draftId}`, full)).status === 200);
  check("submitted for review", (await admin.req("POST", `/api/admin/lessons/${draftId}/status`, { action: "submit" })).json?.data?.status === "in_review");
  check("schedule in the past rejected", (await admin.req("POST", `/api/admin/lessons/${draftId}/schedule`, { scheduledAt: "2020-01-01T00:00:00Z" })).status === 400);
  const pub = await admin.req("POST", `/api/admin/lessons/${draftId}/publish`);
  check("published", pub.json?.data?.status === "published");
  check("learner can now read it", (await a.req("GET", `/api/lessons/${draftId}`)).status === 200);
  check("unpublished", (await admin.req("POST", `/api/admin/lessons/${draftId}/status`, { action: "unpublish" })).json?.data?.status === "draft");
  check("archived", (await admin.req("POST", `/api/admin/lessons/${draftId}/status`, { action: "archive" })).json?.data?.status === "archived");
  check("AI drafting is admin-only (403)", (await a.req("POST", "/api/admin/lessons/generate", { topicId: ids[0], objective: "Explain compound interest simply" })).status === 403);
  check("admin preview renders", (await admin.req("GET", `/admin/lessons/${draftId}/preview`)).status === 200);
  check("admin pages render", (await admin.req("GET", "/admin")).status === 200 && (await admin.req("GET", "/admin/overview")).status === 200);

  console.log("\nScheduled job");
  const secret = env("CRON_SECRET");
  check("job rejects missing secret (401)", (await anon.req("POST", "/api/jobs/daily-delivery")).status === 401);
  const run1 = await anon.req("POST", "/api/jobs/daily-delivery", undefined, { Authorization: `Bearer ${secret}` });
  check("job runs", run1.status === 200, run1.json);
  const run2 = await anon.req("POST", "/api/jobs/daily-delivery", undefined, { Authorization: `Bearer ${secret}` });
  check("second run sends no duplicate emails", run2.json?.data?.emailsSent === 0, run2.json?.data);
  check("second run assigns nothing new", run2.json?.data?.lessonsAssigned === 0, run2.json?.data);

  console.log("\nSign-out & cleanup");
  await b.req("POST", "/api/auth/logout");
  check("signed out → 401", (await b.req("GET", "/api/me")).status === 401);
  await b.req("POST", "/api/auth/login", { email: `smoke-b-${stamp}@example.com`, password: "smokepass123" });
  check("account deletion requires confirmation", (await b.req("DELETE", "/api/me", { confirm: "nope" })).status === 400);
  check("learner B deleted", (await b.req("DELETE", "/api/me", { confirm: "DELETE" })).status === 204);
  check("learner A deleted", (await a.req("DELETE", "/api/me", { confirm: "DELETE" })).status === 204);
  check("deleted user's session is gone", (await a.req("GET", "/api/me")).status === 401);
  check("published lessons can't be deleted (409)", (await admin.req("DELETE", `/api/admin/lessons/${lessonId}`)).status === 409);
  check("learner can't delete lessons (401/403)", [401, 403].includes((await b.req("DELETE", `/api/admin/lessons/${draftId}`)).status));
  check("unused test lesson deleted (204)", (await admin.req("DELETE", `/api/admin/lessons/${draftId}`)).status === 204);
  check("deleted lesson is gone (404)", (await admin.req("GET", `/api/admin/lessons/${draftId}`)).status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
