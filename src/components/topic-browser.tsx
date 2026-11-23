"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { CatalogueTopic } from "@/server/topics";
import { useTopicQuery } from "./header-search";
import { TopicIcon } from "./topic-icon";
import { Reveal } from "./motion";
import { cn } from "./ui";

/**
 * Filterable catalogue of all topics, grouped by collection. The text search lives in the app
 * header (HeaderSearch) and reaches this list through the ?q= URL parameter.
 */
export function TopicBrowser({ topics, followingIds }: { topics: CatalogueTopic[]; followingIds: string[] }) {
  const query = useTopicQuery();
  const [group, setGroup] = useState("All");
  const groups = useMemo(() => ["All", ...new Set(topics.map((t) => t.groupName))], [topics]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: CatalogueTopic) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return groups
      .filter((g) => g !== "All" && (group === "All" || group === g))
      .map((g) => ({ group: g, topics: topics.filter((t) => t.groupName === g && match(t)) }))
      .filter((s) => s.topics.length);
  }, [topics, groups, group, query]);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:px-0">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Filter by collection">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                group === g ? "bg-ink text-bg" : "bg-surface text-muted hover:text-ink",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 && <p className="py-16 text-center text-muted">No topics match &ldquo;{query}&rdquo;.</p>}

      {sections.map((s) => (
        <section key={s.group} className="mt-10" aria-labelledby={`g-${s.group}`}>
          <h2 id={`g-${s.group}`} className="font-display text-2xl font-semibold">
            {s.group}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.topics.map((t, i) => {
              const following = followingIds.includes(t.id);
              return (
                <Reveal as="li" key={t.id} delay={(i % 6) * 50}>
                  <Link
                    href={`/topics/${t.slug}`}
                    className="group flex h-full items-start gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform group-hover:scale-110">
                      <TopicIcon iconKey={t.iconKey} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {t.name}
                        {following && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                            <Check className="size-3" aria-hidden /> Following
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{t.description}</span>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
