import { prisma } from "@/lib/db";

export type CatalogueTopic = {
  id: string;
  slug: string;
  name: string;
  description: string;
  groupName: string;
  iconKey: string;
  isFeatured: boolean;
};

/** Active catalogue ordered featured-first (by rank), then catalogue order. */
export function getTopicCatalogue(): Promise<CatalogueTopic[]> {
  return prisma.topic.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }],
    select: { id: true, slug: true, name: true, description: true, groupName: true, iconKey: true, isFeatured: true },
  });
}

export const TOPIC_LESSONS_PAGE_SIZE = 10;

export async function getTopicWithLessons(slug: string, userId: string, page = 1) {
  const topic = await prisma.topic.findFirst({ where: { slug, isActive: true } });
  if (!topic) return null;
  const skip = (Math.max(1, page) - 1) * TOPIC_LESSONS_PAGE_SIZE;
  const rows = await prisma.lesson.findMany({
    where: { topicId: topic.id, status: "published", publishedAt: { lte: new Date() } },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    skip,
    take: TOPIC_LESSONS_PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      hook: true,
      readTimeMinutes: true,
      progress: { where: { userId }, select: { status: true } },
      bookmarks: { where: { userId }, select: { id: true } },
    },
  });
  return {
    topic,
    hasMore: rows.length > TOPIC_LESSONS_PAGE_SIZE,
    lessons: rows.slice(0, TOPIC_LESSONS_PAGE_SIZE).map((l) => ({
      lesson: { id: l.id, title: l.title, hook: l.hook, readTimeMinutes: l.readTimeMinutes, topic: { id: topic.id, name: topic.name, slug: topic.slug, iconKey: topic.iconKey } },
      completed: l.progress[0]?.status === "completed",
      bookmarked: l.bookmarks.length > 0,
    })),
  };
}
