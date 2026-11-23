import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowRight, CalendarDays, Coffee, Flame, PartyPopper, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { friendlyDate, greeting } from "@/lib/time";
import { getTodayFeed } from "@/server/feed";
import { getLearningStats } from "@/server/lessons";
import { track } from "@/server/analytics";
import { LessonCard } from "@/components/lesson-card";
import { Reveal } from "@/components/motion";
import { TopicIcon } from "@/components/topic-icon";
import { Alert, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser();
  const { welcome } = await searchParams;
  const [feed, stats] = await Promise.all([getTodayFeed(user.id, user.profile.timezone), getLearningStats(user.id, user.profile.timezone)]);
  after(() => track("daily_feed_viewed", user.id, { count: feed.items.length, localDate: feed.localDate }));

  const done = feed.items.filter((i) => i.completed).length;
  const total = feed.items.length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const name = user.profile.displayName;

  return (
    <div>
      {welcome && (
        <Reveal>
          <Alert tone="success" className="mb-6">
            You&apos;re all set. Here are your first lessons.
          </Alert>
        </Reveal>
      )}

      {/* Greeting + daily progress */}
      <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
            <CalendarDays className="size-4" aria-hidden /> {friendlyDate(feed.localDate)}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Today
            <span className="block text-2xl font-normal text-muted sm:text-3xl">
              {greeting(user.profile.timezone)}
              {name ? `, ${name}` : ""}.
            </span>
          </h1>
        </Reveal>
        {total > 0 && (
          <Reveal delay={100} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 pr-6 shadow-card">
            <ProgressRing pct={pct} done={done} total={total} />
            <div>
              <p className="font-semibold">
                {done} of {total} done today
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Flame className="size-4 text-accent" aria-hidden />
                {stats.streak > 0 ? `${stats.streak}-day streak` : "Finish one to start a streak"}
              </p>
            </div>
          </Reveal>
        )}
      </section>

      {allDone && (
        <Reveal variant="scale" className="mt-8">
          <div className="flex flex-col items-start gap-4 rounded-3xl bg-ink p-6 text-bg sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <PartyPopper className="size-10 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="font-display text-2xl font-semibold">That&apos;s everything for today.</p>
                <p className="opacity-75">New lessons tomorrow. If you want more now, have a look through the topics.</p>
              </div>
            </div>
            <LinkButton href="/topics" variant="primary">
              Browse topics <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          </div>
        </Reveal>
      )}

      {/* Feed */}
      {total === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Coffee className="size-7" />}
            title="We're preparing your next lesson"
            action={<LinkButton href="/topics">Browse the topic library</LinkButton>}
          >
            You&apos;ve read everything we have in your topics so far. Try another topic, or check back tomorrow.
          </EmptyState>
        </div>
      ) : (
        <section aria-label="Today's lessons" className="mt-10 grid gap-5 md:grid-cols-2">
          {feed.items.map((item, i) => (
            <Reveal key={item.deliveryId} delay={i * 90} className={i === 0 && total % 2 === 1 ? "md:col-span-2" : ""}>
              <LessonCard item={item} featured={i === 0 && total % 2 === 1} />
            </Reveal>
          ))}
        </section>
      )}

      {/* Non-blocking empty states for topics with no content yet */}
      {feed.emptyTopics.length > 0 && total > 0 && (
        <Reveal className="mt-8">
          <div className="rounded-3xl border border-dashed border-line p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-accent" aria-hidden /> More on the way
            </p>
            <p className="mt-1 text-sm text-muted">You&apos;ve finished everything we have in these topics. We&apos;re writing more.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {feed.emptyTopics.map((t) => (
                <li key={t.id}>
                  <Link href={`/topics/${t.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium hover:text-accent">
                    <TopicIcon iconKey={t.iconKey} className="size-3.5" /> {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      {total > 0 && (
        <div className="mt-10 flex justify-center">
          <Link href="/library?tab=completed" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
            Lessons you&apos;ve finished <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ pct, done, total }: { pct: number; done: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0" role="img" aria-label={`${done} of ${total} lessons done today`}>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums" aria-hidden>
        {done}/{total}
      </span>
      <RingSvg pct={pct} r={r} c={c} />
    </div>
  );
}

function RingSvg({ pct, r, c }: { pct: number; r: number; c: number }) {
  return (
    <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-surface-2" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        className="stroke-accent transition-[stroke-dashoffset] duration-1000"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
      />
    </svg>
  );
}
