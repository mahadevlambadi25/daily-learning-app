/**
 * Click-to-content timing for core journeys (perceived speed). Runs each journey twice:
 * "cold" (first visit; in dev this includes compiling the route) and "warm".
 *   BASE_URL=http://localhost:3000 npx tsx scripts/perf-nav.ts
 */
import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let currentPage: Page;

async function timeIt(label: string, action: () => Promise<unknown>, done: () => Promise<unknown>) {
  // Let the previous screen finish loading (hydration, prefetch) before the timed click, like a real user.
  await currentPage.waitForLoadState("networkidle").catch(() => undefined);
  const t = performance.now();
  await action();
  await done();
  return { label, ms: Math.round(performance.now() - t) };
}

async function journey(page: Page) {
  const r: { label: string; ms: number }[] = [];
  const nav = (name: RegExp | string) => page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name });
  r.push(await timeIt("Today → open lesson", () => page.locator("article h3 a").first().click(), () => page.getByRole("heading", { name: "Key takeaways" }).waitFor()));
  const bookmark = page.locator("button[aria-pressed]", { hasText: /^Saved?$/ });
  r.push(
    await timeIt(
      "bookmark click (API)",
      () => Promise.all([page.waitForResponse((res) => res.url().includes("/bookmark")), bookmark.click()]),
      async () => undefined,
    ),
  );
  await Promise.all([page.waitForResponse((res) => res.url().includes("/bookmark")), bookmark.click()]); // undo
  r.push(await timeIt("→ Library", () => nav("Library").click(), () => page.getByRole("heading", { name: "Your library" }).waitFor()));
  r.push(await timeIt("→ Topics", () => nav("Topics").click(), () => page.getByRole("heading", { name: "Topic library" }).waitFor()));
  r.push(await timeIt("→ Settings", () => nav("Settings").click(), () => page.getByRole("heading", { name: "Settings", exact: true }).waitFor()));
  r.push(await timeIt("Save preferences", () => page.getByRole("button", { name: "Save preferences" }).click(), () => page.getByText("Preferences saved.").waitFor()));
  r.push(await timeIt("→ Today", () => nav("Today").click(), () => page.getByRole("heading", { name: /^Today/ }).waitFor()));
  return r;
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  page.setDefaultTimeout(120_000);
  currentPage = page;
  const results: Record<string, number[]> = {};
  const add = (rows: { label: string; ms: number }[]) => rows.forEach((x) => (results[x.label] ??= []).push(x.ms));

  let t = performance.now();
  await page.goto(`${BASE}/signup`);
  await page.fill("#email", `perf-${Date.now()}@example.com`);
  await page.fill("#password", "perf-pass-123");
  await page.check("input[type=checkbox]");
  add([{ label: "page load /signup", ms: Math.round(performance.now() - t) }]);
  add([await timeIt("Sign up → topics", () => page.click("button[type=submit]"), () => page.waitForURL("**/onboarding/topics"))]);
  for (const n of ["Personal Finance", "Productivity", "Communication"]) await page.getByRole("button", { name: new RegExp(`^${n}`) }).first().click();
  add([await timeIt("Continue → preferences", () => page.getByRole("button", { name: /Continue/ }).click(), () => page.getByRole("heading", { name: /When should we deliver/ }).waitFor())]);
  add([await timeIt("Save → Today", () => page.getByRole("button", { name: /Save and see/ }).click(), () => page.getByRole("heading", { name: /^Today/ }).waitFor())]);

  add(await journey(page)); // cold
  add(await journey(page)); // warm

  await page.evaluate(() => fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }));
  await browser.close();

  console.log(`\n${BASE}`);
  console.log("action".padEnd(28), "cold ms".padStart(9), "warm ms".padStart(9));
  for (const [label, v] of Object.entries(results)) console.log(label.padEnd(28), String(v[0]).padStart(9), String(v[1] ?? "").padStart(9));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
