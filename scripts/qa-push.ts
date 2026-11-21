/**
 * Real-browser check of push reminders: subscribe through the browser's push service and
 * send a test reminder via the server (web-push → push service). Requires VAPID keys.
 *   BASE_URL=http://localhost:3000 npx tsx scripts/qa-push.ts     (HEADED=1 to watch it)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function main() {
  // Web Push is disabled in incognito-style contexts, so use a real (throwaway) profile.
  const profileDir = mkdtempSync(join(tmpdir(), "qa-push-"));
  const ctx = await chromium.launchPersistentContext(profileDir, {
    channel: (process.env.BROWSER_CHANNEL as "msedge" | "chrome") ?? "msedge",
    headless: !process.env.HEADED,
  });
  await ctx.grantPermissions(["notifications"], { origin: BASE });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const email = `push-qa-${Date.now()}@example.com`;
  const step = (s: string) => console.log(`• ${s}`);

  try {
    await page.goto(`${BASE}/signup`);
    await page.fill("#email", email);
    await page.fill("#password", "push-qa-pass-1");
    await page.check("input[type=checkbox]");
    await page.click("button[type=submit]");
    await page.waitForURL("**/onboarding/topics");
    await page.getByRole("button", { name: /^Communication Skills/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.waitForURL("**/onboarding/preferences");
    step("signed up and chose a topic");

    const turnOn = page.getByRole("button", { name: /Turn on notifications/ });
    await turnOn.waitFor({ timeout: 15000 });
    step("reminder panel shown under the reminder switch");
    await turnOn.click();
    const outcome = await Promise.race([
      page.getByText("This device gets your reminder.").waitFor({ timeout: 30000 }).then(() => "subscribed"),
      page.getByText(/Couldn't turn on notifications|blocked/).waitFor({ timeout: 30000 }).then(() => "failed"),
    ]);
    if (outcome !== "subscribed") throw new Error("browser refused the push subscription");
    step("browser subscribed via its push service; subscription saved on the server");

    await page.getByRole("button", { name: "Send a test" }).click();
    const sent = await Promise.race([
      page.getByText("Test sent.").waitFor({ timeout: 30000 }).then(() => true),
      page.locator("[aria-live=polite] p.mt-2").waitFor({ timeout: 30000 }).then(() => false),
    ]);
    if (!sent) throw new Error(`test push failed: ${await page.locator("[aria-live=polite] p.mt-2").textContent()}`);
    step("server sent a test reminder through the push service (accepted)");

    await page.getByRole("button", { name: "Turn off here" }).click();
    await page.getByRole("button", { name: /Turn on notifications/ }).waitFor({ timeout: 15000 });
    step("turned off on this device");
    console.log("\n✓ Push reminders work end to end");
  } finally {
    await page.evaluate(() => fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })).catch(() => undefined);
    await ctx.close();
    rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
