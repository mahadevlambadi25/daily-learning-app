import { prisma } from "@/lib/db";

const DAY = 86_400_000;

/** MVP dashboard metrics (PRD §16), computed from the first-party event log. */
export async function getDashboardMetrics(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const count = (name: string) => prisma.analyticsEvent.count({ where: { name, createdAt: { gte: since } } });
  const distinctUsers = async (name: string, from: Date) =>
    (await prisma.analyticsEvent.findMany({ where: { name, createdAt: { gte: from }, userId: { not: null } }, distinct: ["userId"], select: { userId: true } })).length;

  const [signups, onboarded, completions, listens, bookmarks, opens, emailsSent, emailsFailed, activeToday, activeLearners, firstLessonUsers] =
    await Promise.all([
      count("signup_completed"),
      count("onboarding_topics_saved"),
      count("lesson_completed"),
      count("lesson_listen_started"),
      count("lesson_bookmarked"),
      count("lesson_opened"),
      count("daily_email_sent"),
      count("daily_email_failed"),
      distinctUsers("lesson_opened", new Date(Date.now() - DAY)),
      distinctUsers("lesson_opened", since),
      distinctUsers("lesson_completed", since),
    ]);

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const topicSelections = await prisma.userTopic.groupBy({ by: ["topicId"], where: { isActive: true }, _count: { _all: true } });
  const topicNames = new Map((await prisma.topic.findMany({ select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const topTopics = topicSelections
    .map((t) => ({ name: topicNames.get(t.topicId) ?? "Unknown", count: t._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    days,
    signups,
    signupToTopicsPct: pct(onboarded, signups),
    firstLessonUsers,
    dailyActiveLearners: activeToday,
    completionsPerActive: activeLearners ? +(completions / activeLearners).toFixed(1) : 0,
    completions,
    listenPct: pct(listens, opens),
    bookmarkPct: pct(bookmarks, opens),
    emailsSent,
    emailFailurePct: pct(emailsFailed, emailsSent + emailsFailed),
    topTopics,
  };
}

export function getRecentJobRuns(limit = 8) {
  return prisma.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}

export async function getStatusCounts() {
  const rows = await prisma.lesson.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}
