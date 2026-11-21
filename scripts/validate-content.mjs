// Validates seed lesson JSON files against the PRD §8 lesson content standard.
// Usage: node scripts/validate-content.mjs [file ...]   (defaults to all prisma/seed-content/*.json)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "prisma", "seed-content");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
let errors = 0;
let total = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  for (const [i, l] of (data.lessons ?? []).entries()) {
    total++;
    const where = `${file} #${i} (${l.topic_slug})`;
    const fail = (msg) => { errors++; console.error(`✗ ${where}: ${msg}`); };
    if (!/^[a-z0-9-]+$/.test(l.topic_slug ?? "")) fail("bad topic_slug");
    if (!l.title || l.title.length > 90) fail(`title length ${l.title?.length}`);
    if (!l.hook || l.hook.length > 300) fail(`hook length ${l.hook?.length}`);
    const wc = words(l.body ?? "");
    if (wc < 150 || wc > 250) fail(`body word count ${wc} (need 150-250)`);
    if (!Array.isArray(l.takeaways) || l.takeaways.length !== 3) fail("need exactly 3 takeaways");
    else l.takeaways.forEach((t, j) => { if (!t || t.length > 160) fail(`takeaway ${j} length ${t?.length}`); });
    if (!l.action_text || l.action_text.length > 500) fail(`action_text length ${l.action_text?.length}`);
    if (!Array.isArray(l.sources) || l.sources.length < 1) fail("need at least 1 source");
    else l.sources.forEach((s, j) => {
      if (!s.source_title) fail(`source ${j} missing title`);
      if (s.source_url && !/^https:\/\//.test(s.source_url)) fail(`source ${j} url must be https`);
    });
    for (const [j, q] of (l.questions ?? []).entries()) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) fail(`question ${j} needs 4 options`);
      if (!(q.correct_index >= 0 && q.correct_index <= 3)) fail(`question ${j} correct_index must be 0-3`);
      if (!q.explanation) fail(`question ${j} missing explanation`);
    }
    if ((l.questions ?? []).length > 3) fail("max 3 questions");
  }
}
console.log(errors ? `\n${errors} error(s) in ${total} lessons` : `✓ ${total} lessons valid`);
process.exit(errors ? 1 : 0);
