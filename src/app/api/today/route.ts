import { after } from "next/server";
import { ok, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/session";
import { getTodayFeed } from "@/server/feed";
import { track } from "@/server/analytics";

export const GET = route(async () => {
  const user = await requireApiUser();
  const feed = await getTodayFeed(user.id, user.profile.timezone);
  after(() => track("daily_feed_viewed", user.id, { count: feed.items.length, localDate: feed.localDate }));
  return ok(feed.items, { meta: { localDate: feed.localDate, emptyTopics: feed.emptyTopics } });
});
