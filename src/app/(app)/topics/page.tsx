import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { getTopicCatalogue } from "@/server/topics";
import { getActiveTopicIds } from "@/server/users";
import { TopicBrowser } from "@/components/topic-browser";
import { Reveal } from "@/components/motion";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage() {
  const user = await requirePageUser();
  const [topics, following] = await Promise.all([getTopicCatalogue(), getActiveTopicIds(user.id)]);
  return (
    <div>
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Topic library</h1>
          <p className="mt-2 text-muted">
            Browse all {topics.length} topics. You&apos;re following {following.length} of up to 5.
          </p>
        </div>
        <LinkButton href="/settings#topics" variant="secondary">
          Edit my topics
        </LinkButton>
      </Reveal>
      <div className="mt-6">
        <TopicBrowser topics={topics} followingIds={following} />
      </div>
    </div>
  );
}
