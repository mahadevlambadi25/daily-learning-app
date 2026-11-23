/**
 * Visual + responsive QA: screenshots core screens at mobile (360px) and desktop widths and
 * fails if any page overflows horizontally (PRD §17). Uses the locally installed Edge/Chrome.
 *   BASE_URL=http://localhost:3000 npx tsx scripts/qa-screens.ts
 * Also renders the PWA PNG icons from public/icon.svg.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "qa-screenshots";
const CHANNEL = (process.env.BROWSER_CHANNEL as "msedge" | "chrome") ?? "msedge";

function env(name: string) {
  return process.env[name] ?? readFileSync(".env", "utf8").match(new RegExp(`^${name}="?([^"\\n]*)"?`, "m"))?.[1];
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > w + 1 && getComputedStyle(el).position !== "fixed" && !el.closest("[class*='overflow-x-auto'],[class*='overflow-hidden'],[class*='no-scrollbar']");
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { scrollWidth: document.documentElement.scrollWidth, width: w, offenders };
  });
}

async function shoot(page: Page, name: string, path: string, label: string) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  // Scroll through so scroll-reveal content becomes visible, then back to top.
  await page.evaluate(async () => {
    // "instant" overrides the site's smooth scrolling, which would otherwise swallow rapid scrollTo calls.
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 400));
  });
  const o = await overflow(page);
  const ok = o.scrollWidth <= o.width + 1;
  console.log(`${ok ? "✓" : "✗"} [${label}] ${path} ${ok ? "" : `overflow ${o.scrollWidth}>${o.width} ${o.offenders.join(", ")}`}`);
  await page.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: true });
  return ok;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: CHANNEL, headless: true });
  let failures = 0;

  // PWA icons from the SVG
  {
    const svg = readFileSync("public/icon.svg", "utf8");
    const page = await browser.newPage();
    for (const [size, file, pad] of [[192, "icon-192.png", 0], [512, "icon-512.png", 0], [512, "icon-maskable-512.png", 0.12]] as const) {
      await page.setViewportSize({ width: size, height: size });
      const inner = Math.round(size * (1 - pad * 2));
      await page.setContent(
        `<html><body style="margin:0;background:${pad ? "#c2410c" : "transparent"};display:grid;place-items:center;height:${size}px">${svg.replace("<svg", `<svg width="${inner}" height="${inner}"`)}</body></html>`,
      );
      await page.screenshot({ path: `public/${file}`, omitBackground: !pad });
    }
    await page.close();
    console.log("✓ PWA icons rendered to public/");
  }

  for (const vp of [{ label: "mobile", width: 360, height: 780 }, { label: "desktop", width: 1280, height: 860 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const results: boolean[] = [];

    results.push(await shoot(page, "01-landing", "/", vp.label));
    results.push(await shoot(page, "02-signup", "/signup", vp.label));

    // New learner through onboarding
    const email = `qa-${vp.label}-${Date.now()}@example.com`;
    await page.goto(`${BASE}/signup`);
    await page.fill("#displayName", "Asha");
    await page.fill("#email", email);
    await page.fill("#password", "qa-password-1");
    await page.check("input[type=checkbox]");
    await page.click("button[type=submit]");
    await page.waitForURL("**/onboarding/topics");
    for (const name of ["Personal Finance & Budgeting", "Productivity & Time Management", "Artificial Intelligence & AI Tools"]) {
      await page.getByRole("button", { name: new RegExp(`^${name.replace(/[&]/g, ".")}`) }).first().click();
    }
    results.push(await shoot(page, "03-onboarding-topics", "/onboarding/topics", vp.label));
    // Selections are only saved on Continue, so re-select after the reload done by shoot().
    for (const name of ["Personal Finance & Budgeting", "Productivity & Time Management", "Artificial Intelligence & AI Tools"]) {
      await page.getByRole("button", { name: new RegExp(`^${name.replace(/[&]/g, ".")}`) }).first().click();
    }
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.waitForURL("**/onboarding/preferences");
    results.push(await shoot(page, "04-onboarding-prefs", "/onboarding/preferences", vp.label));
    await page.getByRole("button", { name: /Save and see/ }).click();
    await page.waitForURL("**/today**");

    results.push(await shoot(page, "05-today", "/today", vp.label));
    const firstLesson = await page.locator("article h3 a").first().getAttribute("href");
    results.push(await shoot(page, "06-lesson", firstLesson!, vp.label));
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${vp.label}-06b-lesson-listen.png` });
    await page.getByRole("button", { name: /Mark as completed/ }).click();
    await page.waitForTimeout(500);
    results.push(await shoot(page, "07-library", "/library?tab=completed", vp.label));
    results.push(await shoot(page, "08-topics", "/topics", vp.label));
    results.push(await shoot(page, "09-settings", "/settings", vp.label));
    // Clean up the QA learner
    await page.evaluate(() => fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }));

    // Admin
    await page.goto(`${BASE}/login`);
    await page.fill("#email", env("SEED_ADMIN_EMAIL")!);
    await page.fill("#password", env("SEED_ADMIN_PASSWORD")!);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/(admin|today|onboarding)/); // admins land on the console
    results.push(await shoot(page, "10-admin-lessons", "/admin", vp.label));
    const editHref = await page.locator("a[href^='/admin/lessons/']:not([href$='/new'])").first().getAttribute("href");
    results.push(await shoot(page, "11-admin-overview", "/admin/overview", vp.label));
    results.push(await shoot(page, "12-admin-editor", editHref!, vp.label));
    results.push(await shoot(page, "13-admin-new", "/admin/lessons/new", vp.label));

    failures += results.filter((r) => !r).length;
    await ctx.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures} page(s) overflow horizontally` : "\n✓ No horizontal overflow on any core screen");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
