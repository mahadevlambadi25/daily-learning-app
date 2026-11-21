import { ok, route } from "@/lib/api";
import { getTopicCatalogue } from "@/server/topics";

export const revalidate = 300;

export const GET = route(async () => {
  const topics = await getTopicCatalogue();
  return ok(topics, { meta: { total: topics.length, featured: topics.filter((t) => t.isFeatured).length } });
});
