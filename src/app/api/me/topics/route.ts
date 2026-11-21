import { ok, parseJson, route } from "@/lib/api";
import { topicSelectionSchema } from "@/lib/validation";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { getActiveTopicIds, setUserTopics } from "@/server/users";

async function selectedTopics(userId: string) {
  const ids = await getActiveTopicIds(userId);
  const topics = await prisma.topic.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, iconKey: true, groupName: true },
  });
  return ids.map((id) => topics.find((t) => t.id === id)!).filter(Boolean);
}

export const GET = route(async () => {
  const user = await requireApiUser();
  return ok(await selectedTopics(user.id));
});

export const PUT = route(async (req) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "topics-put", 30, 60_000, user.id);
  const { topicIds } = await parseJson(req, topicSelectionSchema);
  await setUserTopics(user.id, topicIds);
  return ok(await selectedTopics(user.id));
});
