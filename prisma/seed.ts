/**
 * Seeds the 50-topic catalogue and the starter lesson pack. Idempotent: safe to re-run.
 *   npm run db:seed
 * Starter lessons are published with rights basis "original" so every topic has content.
 * They were AI-assisted drafts: an editor must review them before a public launch (PRD §8.1).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { TOPICS } from "./data/topics";
import { estimateReadTime } from "../src/lib/lesson-content";
import { generateToken, hashPassword } from "../src/lib/auth/tokens";

const prisma = new PrismaClient();
/** `npm run db:seed -- --sync` re-applies seed content to existing lessons (overwrites CMS edits to them). */
const SYNC = process.argv.includes("--sync");

type SeedLesson = {
  topic_slug: string;
  title: string;
  hook: string;
  body: string;
  takeaways: [string, string, string];
  action_text: string;
  sources: { source_title: string; source_url?: string; author_or_publisher?: string }[];
  questions?: { question: string; options: [string, string, string, string]; correct_index: number; explanation: string }[];
  /** Earlier titles of this lesson, so an editorial rename updates the existing row instead of duplicating it. */
  previous_titles?: string[];
};

function contentData(l: SeedLesson) {
  const [t1, t2, t3] = l.takeaways;
  return {
    title: l.title,
    hook: l.hook,
    body: l.body,
    takeaway1: t1,
    takeaway2: t2,
    takeaway3: t3,
    actionText: l.action_text,
    readTimeMinutes: estimateReadTime(l.hook, l.body, t1, t2, t3, l.action_text),
  };
}

function childData(l: SeedLesson) {
  return {
    sources: l.sources.map((s) => ({
      sourceTitle: s.source_title,
      sourceUrl: s.source_url || null,
      authorOrPublisher: s.author_or_publisher || null,
      accessedAt: new Date(),
      rightsBasis: "original",
      reviewerNote: "Seed content: original synthesis. Requires editorial review before public launch.",
    })),
    questions: (l.questions ?? []).map((q, i) => ({
      question: q.question,
      optionA: q.options[0],
      optionB: q.options[1],
      optionC: q.options[2],
      optionD: q.options[3],
      correctOption: "abcd"[q.correct_index],
      explanation: q.explanation,
      displayOrder: i,
    })),
  };
}

async function seedTopics() {
  const featured = TOPICS.filter((t) => t.featuredRank).sort((a, b) => a.featuredRank! - b.featuredRank!);
  for (const [i, t] of TOPICS.entries()) {
    // Featured topics first (by rank), then catalogue order.
    const displayOrder = t.featuredRank ? t.featuredRank : featured.length + i + 1;
    const data = {
      name: t.name,
      description: t.description,
      groupName: t.group,
      iconKey: t.iconKey,
      isFeatured: Boolean(t.featuredRank),
      displayOrder,
      isActive: true,
    };
    await prisma.topic.upsert({ where: { slug: t.slug }, create: { slug: t.slug, ...data }, update: data });
  }
  console.log(`✓ ${TOPICS.length} topics (${featured.length} featured)`);
}

async function seedLessons() {
  const dir = join(__dirname, "seed-content");
  const lessons: SeedLesson[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).lessons as SeedLesson[]);

  const topics = new Map((await prisma.topic.findMany()).map((t) => [t.slug, t.id]));
  const perTopic = new Map<string, number>();
  // Stagger publish dates so the "oldest first" rule yields a stable order per topic.
  const base = Date.now() - 30 * 86_400_000;
  let created = 0;
  let renamed = 0;

  for (const l of lessons) {
    const topicId = topics.get(l.topic_slug);
    if (!topicId) throw new Error(`Unknown topic slug: ${l.topic_slug}`);
    const n = perTopic.get(l.topic_slug) ?? 0;
    perTopic.set(l.topic_slug, n + 1);

    // Same title: leave it alone unless --sync was passed (which overwrites CMS edits with the seed file).
    const same = await prisma.lesson.findFirst({ where: { topicId, title: l.title } });
    if (same && !SYNC) continue;

    // Editorial rename (or --sync): update the existing lesson in place (keeps its id, deliveries and progress).
    const old =
      same ??
      (l.previous_titles?.length ? await prisma.lesson.findFirst({ where: { topicId, title: { in: l.previous_titles } } }) : null);
    if (old) {
      const { sources, questions } = childData(l);
      await prisma.$transaction([
        prisma.lessonSource.deleteMany({ where: { lessonId: old.id } }),
        prisma.lessonQuestion.deleteMany({ where: { lessonId: old.id } }),
        prisma.lesson.update({
          where: { id: old.id },
          data: { ...contentData(l), sources: { create: sources }, questions: { create: questions } },
        }),
      ]);
      renamed++;
      continue;
    }

    const publishedAt = new Date(base + n * 86_400_000);
    const { sources, questions } = childData(l);
    await prisma.lesson.create({
      data: {
        topicId,
        ...contentData(l),
        rightsBasis: "original",
        requiresSources: true,
        status: "published",
        publishedAt,
        approvedAt: publishedAt,
        sources: { create: sources },
        questions: { create: questions },
      },
    });
    created++;
  }
  console.log(`✓ ${created} lessons created, ${renamed} updated from editorial changes (${lessons.length - created - renamed} unchanged)`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return console.log("• SEED_ADMIN_EMAIL/PASSWORD not set; skipping admin account");
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        profile: { create: { displayName: "Admin", unsubscribeToken: generateToken(24) } },
        roles: { create: { role: "learner" } },
      },
    });
  }
  await prisma.role.upsert({
    where: { userId_role: { userId: user.id, role: "admin" } },
    create: { userId: user.id, role: "admin" },
    update: {},
  });
  console.log(`✓ admin account ready: ${email}`);
}

seedTopics()
  .then(seedLessons)
  .then(seedAdmin)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
