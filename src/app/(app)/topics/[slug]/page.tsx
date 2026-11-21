import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { getTopicWithLessons } from "@/server/topics";
import { getActiveTopicIds } from "@/server/users";
import { LessonCard } from "@/components/lesson-card";
import { Reveal } from "@/components/motion";
import { TopicIcon } from "@/components/topic-icon";
import { Badge, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Topic" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export default async function TopicPage({ params, searchParams }: Props) {
  const user = await requirePageUser();
  const [{ slug }, { page: pageParam }] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(pageParam) || 1);
  const data = await getTopicWithLessons(slug, user.id, page);
  if (!data) notFound();
  const following = (await getActiveTopicIds(user.id)).includes(data.topic.id);

  return (
    <div>
      <Link href="/topics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All topics
      </Link>
      <Reveal className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-accent text-accent-ink shadow-card">
          <TopicIcon iconKey={data.topic.iconKey} className="size-8" />
        </span>
        <div>
          <p className="text-sm font-semibold text-muted">{data.topic.groupName}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{data.topic.name}</h1>
          <p className="mt-1 text-muted">{data.topic.description}</p>
        </div>
        <div className="sm:ml-auto">
          {following ? <Badge tone="success">Following</Badge> : <LinkButton href="/settings#topics" variant="soft" size="sm">Follow this topic</LinkButton>}
        </div>
      </Reveal>

      {data.lessons.length === 0 ? (
        <div className="mt-10">
          <EmptyState icon={<Sparkles className="size-7" />} title="Lessons coming soon">
            We&apos;re writing the first lessons for this topic. Check back shortly.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {data.lessons.map((item, i) => (
            <Reveal as="li" key={item.lesson.id} delay={(i % 4) * 80}>
              <LessonCard item={item} />
            </Reveal>
          ))}
        </ul>
      )}

      {(page > 1 || data.hasMore) && (
        <nav className="mt-10 flex justify-center gap-3" aria-label="Pagination">
          {page > 1 && (
            <LinkButton href={`/topics/${slug}?page=${page - 1}`} variant="secondary">
              <ArrowLeft className="size-4" aria-hidden /> Previous
            </LinkButton>
          )}
          {data.hasMore && (
            <LinkButton href={`/topics/${slug}?page=${page + 1}`} variant="secondary">
              Next <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          )}
        </nav>
      )}
    </div>
  );
}
