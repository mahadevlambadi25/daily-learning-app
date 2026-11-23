"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Search, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { MAX_TOPICS } from "@/lib/config";
import type { CatalogueTopic } from "@/server/topics";
import { TopicIcon } from "./topic-icon";
import { Alert, Button, cn, Input } from "./ui";

type Props = {
  topics: CatalogueTopic[];
  initialSelected: string[];
  mode: "onboarding" | "settings";
};

export function TopicPicker({ topics, initialSelected, mode }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [exploreOpen, setExploreOpen] = useState(mode === "settings" || initialSelected.some((id) => !topics.find((t) => t.id === id)?.isFeatured));
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("All");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const featured = topics.filter((t) => t.isFeatured);
  const groups = useMemo(() => ["All", ...new Set(topics.map((t) => t.groupName))], [topics]);
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const atMax = selected.length >= MAX_TOPICS;
  const dirty = selected.length !== initialSelected.length || selected.some((id) => !initialSelected.includes(id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter(
      (t) =>
        (group === "All" || t.groupName === group) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [topics, query, group]);

  function toggle(id: string) {
    setSaved(false);
    setError(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_TOPICS ? s : [...s, id]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await api("/api/me/topics", { method: "PUT", body: { topicIds: selected } });
    if (!res.ok) {
      setSaving(false);
      setError(res.message);
      return;
    }
    if (mode === "onboarding") {
      router.push("/onboarding/preferences");
    } else {
      setSaving(false);
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div>
      {mode === "onboarding" && (
        <header className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">What would you like to learn about?</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Choose up to 5 topics. We&apos;ll bring you short, useful lessons based on what you care about.
          </p>
        </header>
      )}

      {/* Selected chips (so picks from the full catalogue stay visible) */}
      <div className="mb-6 flex min-h-10 flex-wrap items-center gap-2" aria-live="polite">
        {selected.length === 0 ? (
          <p className="text-sm text-muted">Choose at least 1 topic. You can change your interests anytime.</p>
        ) : (
          selected.map((id) => {
            const t = byId.get(id);
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-ink py-1.5 pr-2 pl-3 text-sm font-semibold text-bg"
                aria-label={`Remove ${t.name}`}
              >
                {t.name}
                <X className="size-3.5" aria-hidden />
              </button>
            );
          })
        )}
      </div>

      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="sr-only">
          Featured topics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((t, i) => (
            <TopicTile key={t.id} topic={t} selected={selected.includes(t.id)} disabled={atMax && !selected.includes(t.id)} onToggle={toggle} index={i} />
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="explore-heading">
        <button
          type="button"
          onClick={() => setExploreOpen((o) => !o)}
          aria-expanded={exploreOpen}
          aria-controls="explore-panel"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-semibold transition-colors hover:bg-surface-2"
          id="explore-heading"
        >
          Explore all {topics.length} topics
          <ChevronDown className={cn("size-4 transition-transform duration-300", exploreOpen && "rotate-180")} aria-hidden />
        </button>

        {exploreOpen && (
          <div id="explore-panel" className="mt-5 rounded-3xl border border-line bg-surface p-4 sm:p-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input type="search" placeholder="Search topics" aria-label="Search topics" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" />
            </div>
            <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by collection">
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  aria-pressed={group === g}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                    group === g ? "bg-ink text-bg" : "bg-surface-2 text-muted hover:text-ink",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-muted">No topics match &ldquo;{query}&rdquo;.</p>
            ) : (
              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filtered.map((t) => {
                  const isSel = selected.includes(t.id);
                  const disabled = atMax && !isSel;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggle(t.id)}
                        aria-pressed={isSel}
                        disabled={disabled}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                          isSel ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2",
                          disabled && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", isSel ? "bg-accent text-accent-ink" : "bg-surface-2 text-accent")}>
                          {isSel ? <Check className="size-4" aria-hidden /> : <TopicIcon iconKey={t.iconKey} className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.name}</span>
                          <span className="block truncate text-sm text-muted">{t.description}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Sticky action bar with the selected-count indicator */}
      <div className={cn("sticky z-30 mt-10", mode === "settings" ? "bottom-20 md:bottom-4" : "bottom-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface/90 p-3 pl-5 shadow-lift backdrop-blur-xl">
          <div className="text-sm">
            <p className="font-semibold" aria-live="polite">
              {selected.length} of {MAX_TOPICS} selected
            </p>
            <p className="text-muted">{atMax ? "That's the limit. Untick one to swap it." : "You can change these whenever you like."}</p>
          </div>
          {mode === "onboarding" ? (
            <Button onClick={save} disabled={selected.length === 0} loading={saving} size="lg">
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button onClick={save} disabled={selected.length === 0 || !dirty} loading={saving}>
              Save topics
            </Button>
          )}
        </div>
        {error && <Alert tone="error" className="mt-3">{error}</Alert>}
        {saved && <Alert tone="success" className="mt-3">Saved. Your Today page now uses these topics.</Alert>}
      </div>
    </div>
  );
}

function TopicTile({
  topic,
  selected,
  disabled,
  onToggle,
  index,
}: {
  topic: CatalogueTopic;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(topic.id)}
      aria-pressed={selected}
      disabled={disabled}
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        "group relative flex h-full items-start gap-4 rounded-3xl border-2 bg-surface p-5 text-left shadow-card transition-all duration-200",
        selected ? "border-accent bg-accent-soft" : "border-line hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift",
        disabled && "cursor-not-allowed opacity-45 hover:translate-y-0 hover:border-line hover:shadow-card",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl transition-all duration-200",
          selected ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent group-hover:scale-105",
        )}
      >
        <TopicIcon iconKey={topic.iconKey} className="size-6" />
      </span>
      <span className="min-w-0 pr-6">
        <span className="block font-semibold leading-snug">{topic.name}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{topic.description}</span>
      </span>
      <span
        className={cn(
          "absolute top-4 right-4 grid size-6 place-items-center rounded-full border-2 transition-all",
          selected ? "animate-pop border-accent bg-accent text-accent-ink" : "border-line",
        )}
        aria-hidden
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}
