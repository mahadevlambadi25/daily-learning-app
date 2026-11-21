// Checks that every source URL in the seed lessons responds (editorial QA, PRD §8.1).
// Usage: node scripts/check-sources.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "prisma", "seed-content");
const urls = new Map(); // url -> [where]
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  for (const l of JSON.parse(readFileSync(join(dir, f), "utf8")).lessons) {
    for (const s of l.sources) if (s.source_url) urls.set(s.source_url, [...(urls.get(s.source_url) ?? []), `${f}: ${l.topic_slug}`]);
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return { ok: true, status: res.status };
      // Many sites block HEAD or bots (403/405/429); retry with GET before judging.
      if (method === "GET") return { ok: false, status: res.status };
    } catch (e) {
      if (method === "GET") return { ok: false, status: e.name === "TimeoutError" ? "timeout" : e.cause?.code ?? e.message };
    }
  }
}

const entries = [...urls.entries()];
const results = [];
for (let i = 0; i < entries.length; i += 8) {
  results.push(...(await Promise.all(entries.slice(i, i + 8).map(async ([url, where]) => ({ url, where, ...(await check(url)) })))));
}
// 401/403/429 mean the site exists but refuses automated requests (bot protection): verify by hand.
const blocked = results.filter((r) => !r.ok && [401, 403, 429].includes(r.status));
const bad = results.filter((r) => !r.ok && !blocked.includes(r));
for (const r of blocked) console.log(`? ${r.status}  ${r.url}  (blocks automated checks; open manually)`);
for (const r of bad) console.log(`✗ ${r.status}  ${r.url}\n    used in: ${r.where.join("; ")}`);
console.log(`\n${results.length - bad.length - blocked.length} OK, ${blocked.length} need a manual check, ${bad.length} broken (of ${results.length})`);
process.exit(bad.length ? 1 : 0);
