import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, CheckCircle2, Flame } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { getLearningStats, getLibrary } from "@/server/lessons";
import { LibraryList } from "@/components/library-list";
import { CountUp, Reveal } from "@/components/motion";
import { cn, EmptyState, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser();
  const { tab } = await searchParams;
  const filter = tab === "completed" ? "completed" : "saved";
  const [library, stats] = await Promise.all([getLibrary(user.id, filter), getLearningStats(user.id, user.profile.timezone)]);

  const tabs = [
    { key: "saved", label: "Saved", icon: Bookmark, count: stats.saved },
    { key: "completed", label: "Completed", icon: CheckCircle2, count: stats.completed },
  ] as const;

  return (
    <div>
      <Reveal>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your library</h1>
        <p className="mt-2 text-muted">Lessons you&apos;ve saved and completed.</p>
      </Reveal>

      {/* Learning history */}
      <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-xl" role="list" aria-label="Learning history">
        {[
          { label: "Completed", value: stats.completed, icon: CheckCircle2 },
          { label: "Day streak", value: stats.streak, icon: Flame },
          { label: "Saved", value: stats.saved, icon: Bookmark },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 80} variant="scale" role="listitem" className="rounded-3xl border border-line bg-surface p-4 shadow-card">
            <s.icon className="size-5 text-accent" aria-hidden />
            <p className="mt-2 font-display text-3xl font-semibold">
              <CountUp value={s.value} />
            </p>
            <p className="text-sm text-muted">{s.label}</p>
          </Reveal>
        ))}
      </div>

      <nav className="mt-10 inline-flex rounded-full border border-line bg-surface p-1" aria-label="Library filter">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/library?tab=${t.key}`}
            aria-current={filter === t.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
              filter === t.key ? "bg-ink text-bg" : "text-muted hover:text-ink",
            )}
          >
            <t.icon className="size-4" aria-hidden /> {t.label} <span className="tabular-nums opacity-60">{t.count}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {library.items.length === 0 ? (
          <EmptyState
            icon={filter === "saved" ? <Bookmark className="size-7" /> : <CheckCircle2 className="size-7" />}
            title={filter === "saved" ? "No saved lessons yet" : "No completed lessons yet"}
            action={<LinkButton href="/today">Go to today&apos;s lessons</LinkButton>}
          >
            {filter === "saved"
              ? "Tap the bookmark on any lesson to keep it here for later."
              : "Lessons you mark as completed will show up here."}
          </EmptyState>
        ) : (
          <LibraryList key={filter} filter={filter} initialItems={library.items} initialHasMore={library.hasMore} />
        )}
      </div>
    </div>
  );
}
