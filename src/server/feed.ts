import { prisma, isUniqueViolation } from "@/lib/db";
import { addDays, localDate as toLocalDate, safeTimezone } from "@/lib/time";
import { getActiveTopicIds } from "./users";

/** Repeatable (evergreen) lessons may be re-assigned after this many days. */
export const REPEAT_COOLDOWN_DAYS = 60;

/** Promotes scheduled lessons whose publish time has arrived. Safe to call repeatedly. */
export async function publishDueLessons(now: Date = new Date()): Promise<number> {
  const due = await prisma.lesson.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    select: { id: true, scheduledAt: true },
  });
  let published = 0;
  for (const l of due) {
    // Conditional update: only one concurrent caller wins the transition.
    const res = await prisma.lesson.updateMany({
      where: { id: l.id, status: "scheduled" },
      data: { status: "published", publishedAt: l.scheduledAt ?? now },
    });
    if (res.count) {
      published++;
      await prisma.auditLog.create({
        data: { action: "auto_publish", entityType: "lesson", entityId: l.id, details: JSON.stringify({ scheduledAt: l.scheduledAt }) },
      });
    }
  }
  return published;
}

/**
 * Deterministic MVP selection rule (PRD §9): the oldest eligible published lesson for the topic
 * that the user has not already received or completed; ties broken by publish date then ID.
 * Falls back to repeatable lessons outside the cooldown window.
 */
export async function pickLessonForTopic(userId: string, topicId: string, localDate: string, now: Date = new Date()) {
  const base = { topicId, status: "published", publishedAt: { lte: now } } as const;
  const fresh = await prisma.lesson.findFirst({
    where: {
      ...base,
      deliveries: { none: { userId } },
      progress: { none: { userId, status: "completed" } },
    },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (fresh) return fresh;

  return prisma.lesson.findFirst({
    where: {
      ...base,
      isRepeatable: true,
      deliveries: { none: { userId, localDate: { gte: addDays(localDate, -REPEAT_COOLDOWN_DAYS) } } },
    },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
}

/**
 * Assigns up to one lesson per active topic for the user's local date. Idempotent: existing
 * assignments are kept, and unique(user, topic, date) / unique(user, lesson, date) constraints
 * make concurrent runs safe.
 */
export async function assignDailyLessons(userId: string, localDate: string, now: Date = new Date()) {
  const topicIds = await getActiveTopicIds(userId);
  const existing = await prisma.delivery.findMany({ where: { userId, localDate }, select: { topicId: true } });
  const covered = new Set(existing.map((d) => d.topicId));
  const created: string[] = [];
  const missingTopicIds: string[] = [];

  for (const topicId of topicIds) {
    if (covered.has(topicId)) continue;
    const lesson = await pickLessonForTopic(userId, topicId, localDate, now);
    if (!lesson) {
      missingTopicIds.push(topicId);
      continue;
    }
    try {
      await prisma.delivery.create({ data: { userId, lessonId: lesson.id, topicId, localDate } });
      created.push(lesson.id);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // another run assigned it first
    }
  }
  return { created, missingTopicIds };
}

export type FeedItem = {
  deliveryId: string;
  lesson: {
    id: string;
    title: string;
    hook: string;
    readTimeMinutes: number;
    topic: { id: string; name: string; slug: string; iconKey: string };
  };
  completed: boolean;
  bookmarked: boolean;
};

/**
 * Today feed: reads delivery records for the user's current local date, filtered to their
 * active topics. Assigns lazily so the feed is ready on first visit (starter feed) and
 * whenever topics change; the scheduled job handles the email at the preferred time.
 */
export async function getTodayFeed(userId: string, timezone: string, now: Date = new Date()) {
  const tz = safeTimezone(timezone);
  const date = toLocalDate(tz, now);
  await publishDueLessons(now);
  await assignDailyLessons(userId, date, now);

  const topicIds = await getActiveTopicIds(userId);
  const deliveries = await prisma.delivery.findMany({
    where: { userId, localDate: date, topicId: { in: topicIds }, lesson: { status: "published" } },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          hook: true,
          readTimeMinutes: true,
          topic: { select: { id: true, name: true, slug: true, iconKey: true } },
          progress: { where: { userId }, select: { status: true } },
          bookmarks: { where: { userId }, select: { id: true } },
        },
      },
    },
  });

  const order = new Map(topicIds.map((id, i) => [id, i]));
  const items: FeedItem[] = deliveries
    .sort((a, b) => (order.get(a.topicId) ?? 0) - (order.get(b.topicId) ?? 0))
    .map((d) => ({
      deliveryId: d.id,
      lesson: {
        id: d.lesson.id,
        title: d.lesson.title,
        hook: d.lesson.hook,
        readTimeMinutes: d.lesson.readTimeMinutes,
        topic: d.lesson.topic,
      },
      completed: d.lesson.progress[0]?.status === "completed",
      bookmarked: d.lesson.bookmarks.length > 0,
    }));

  const delivered = new Set(deliveries.map((d) => d.topicId));
  const emptyTopics = await prisma.topic.findMany({
    where: { id: { in: topicIds.filter((id) => !delivered.has(id)) } },
    select: { id: true, name: true, slug: true, iconKey: true },
  });

  return { localDate: date, items, emptyTopics };
}
