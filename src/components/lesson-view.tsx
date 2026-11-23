"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, ExternalLink, Headphones, Lightbulb, ListChecks, Undo2 } from "lucide-react";
import { parseBody, speechSegments } from "@/lib/lesson-content";
import { api, track } from "@/lib/client-api";
import type { LearnerLesson } from "@/server/lessons";
import { ListenPlayer } from "./listen-player";
import { Quiz } from "./quiz";
import { BookmarkButton } from "./bookmark-button";
import { ReadingProgress, Reveal } from "./motion";
import { TopicIcon } from "./topic-icon";
import { Button, cn } from "./ui";

type Mode = "read" | "listen";

export function LessonView({ lesson, initialMode = "read", preview = false }: { lesson: LearnerLesson; initialMode?: Mode; preview?: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [completed, setCompleted] = useState(lesson.completed);
  const [completing, setCompleting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const segRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Element numbering below follows the speech order: title (0), body blocks, takeaways, action.
  const blocks = useMemo(() => parseBody(lesson.body), [lesson.body]);
  const { segments, takeawayStart } = useMemo(() => speechSegments(lesson), [lesson]);
  const bodyStart = 1;

  /** Props for a speakable element: registers it for follow-along and highlights it while read aloud. */
  const seg = (i: number, className?: string) => ({
    "data-seg": i,
    ref: (el: HTMLElement | null) => {
      if (el) segRefs.current.set(i, el);
      else segRefs.current.delete(i);
    },
    className: cn(className, speaking === i && "is-speaking"),
  });

  // Scroll the paragraph being read into view.
  useEffect(() => {
    if (speaking == null || !follow) return;
    segRefs.current.get(speaking)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [speaking, follow]);

  const onSegmentChange = useCallback((i: number | null) => setSpeaking(i), []);
  const onFirstPlay = useCallback(() => {
    if (!preview) track("lesson_listen_started", { lessonId: lesson.id });
  }, [lesson.id, preview]);

  async function toggleComplete() {
    if (preview) return;
    setCompleting(true);
    const next = !completed;
    const res = await api(`/api/lessons/${lesson.id}/progress`, { method: "POST", body: { status: next ? "completed" : "undo" } });
    setCompleting(false);
    if (res.ok) {
      setCompleted(next);
      setCelebrate(next);
    }
  }

  let bodyIndex = bodyStart;

  return (
    <article id="lesson" className="mx-auto max-w-3xl">
      <ReadingProgress targetId="lesson" />

      {!preview && (
        <Link href="/today" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Today
        </Link>
      )}

      <header className="mt-6">
        <Reveal>
          <Link
            href={preview ? "#" : `/topics/${lesson.topic.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pr-3.5 pl-1.5 text-sm font-semibold text-accent"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-ink">
              <TopicIcon iconKey={lesson.topic.iconKey} className="size-3.5" />
            </span>
            {lesson.topic.name}
          </Link>
        </Reveal>
        <Reveal delay={60}>
          <h1 {...seg(0, "mt-5 font-display text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl")}>
            {lesson.title}
          </h1>
        </Reveal>
        <Reveal delay={120} className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> {lesson.readTimeMinutes} min read
          </span>
          {lesson.publishedAt && (
            <span>
              Published{" "}
              {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(lesson.publishedAt))}
            </span>
          )}
          {completed && (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Completed
            </span>
          )}
        </Reveal>
      </header>

      {/* Read / Listen toggle */}
      <div className="sticky top-16 z-30 -mx-4 mt-8 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-full sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-card" role="group" aria-label="Reading mode">
            {(["read", "listen"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  mode === m ? "bg-ink text-bg shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {m === "read" ? <BookOpen className="size-4" aria-hidden /> : <Headphones className="size-4" aria-hidden />}
                {m === "read" ? "Read" : "Listen"}
              </button>
            ))}
          </div>
          {mode === "listen" && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Follow along
            </label>
          )}
        </div>
        {mode === "listen" && (
          <div className="mt-3">
            <ListenPlayer segments={segments} onSegmentChange={onSegmentChange} onFirstPlay={onFirstPlay} />
          </div>
        )}
      </div>

      {/* Hook + body */}
      <Reveal>
        <p className="mt-8 border-l-4 border-accent pl-5 font-display text-xl leading-relaxed text-ink/90 italic sm:text-2xl">{lesson.hook}</p>
      </Reveal>

      <div className="prose-lesson mt-8">
        {blocks.map((b, bi) =>
          b.type === "p" ? (
            <p key={bi} {...seg(bodyIndex++)}>
              {b.text}
            </p>
          ) : (
            <ul key={bi}>
              {b.items.map((item, ii) => (
                <li key={ii} {...seg(bodyIndex++)}>
                  {item}
                </li>
              ))}
            </ul>
          ),
        )}
      </div>

      {/* Key takeaways */}
      <Reveal className="mt-10">
        <section aria-labelledby="takeaways" className="rounded-3xl bg-ink p-6 text-bg sm:p-8">
          <h2 id="takeaways" {...seg(takeawayStart, cn("flex items-center gap-2 font-display text-2xl font-semibold", speaking === takeawayStart && "text-ink"))}>
            <ListChecks className="size-6 text-accent" aria-hidden /> Key takeaways
          </h2>
          <ol className="mt-5 space-y-4">
            {lesson.takeaways.map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-ink">{i + 1}</span>
                <span {...seg(takeawayStart + 1 + i, cn("pt-1 text-lg leading-relaxed", speaking === takeawayStart + 1 + i && "text-ink"))}>
                  {t}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* Practical action */}
      <Reveal className="mt-6">
        <section aria-labelledby="action" className="rounded-3xl border-2 border-accent/40 bg-accent-soft p-6 sm:p-8">
          <h2 id="action" {...seg(takeawayStart + 1 + lesson.takeaways.length, "flex items-center gap-2 text-sm font-bold tracking-wider text-accent uppercase")}>
            <Lightbulb className="size-5" aria-hidden /> Try this today
          </h2>
          <p {...seg(takeawayStart + 2 + lesson.takeaways.length, "mt-3 text-lg leading-relaxed")}>
            {lesson.actionText}
          </p>
        </section>
      </Reveal>

      {lesson.questions.length > 0 && (
        <Reveal className="mt-6">
          <Quiz lessonId={lesson.id} questions={lesson.questions} disabled={preview} />
        </Reveal>
      )}

      {/* Actions */}
      <Reveal className="mt-10">
        <div className={cn("rounded-3xl border border-line bg-surface p-6 text-center shadow-card transition-colors sm:p-8", completed && "border-success/40 bg-success-soft")}>
          {completed ? (
            <>
              <CheckCircle2 className={cn("mx-auto size-12 text-success", celebrate && "animate-pop")} aria-hidden />
              <p className="mt-3 font-display text-2xl font-semibold">Done</p>
              <p className="mt-1 text-muted">Nice one. Don&apos;t forget to try the action today.</p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold">Finished?</p>
              <p className="mt-1 text-muted">Mark it as done to keep your streak going.</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {preview ? (
              <p className="text-sm text-muted">Actions are disabled in preview.</p>
            ) : (
              <>
                {completed ? (
                  <Button variant="secondary" onClick={toggleComplete} loading={completing}>
                    <Undo2 className="size-4" aria-hidden /> Undo
                  </Button>
                ) : (
                  <Button size="lg" onClick={toggleComplete} loading={completing}>
                    <CheckCircle2 className="size-5" aria-hidden /> Mark as completed
                  </Button>
                )}
                <BookmarkButton lessonId={lesson.id} initial={lesson.bookmarked} variant="full" />
                {completed && (
                  <Link href="/today" className="inline-flex h-11 items-center gap-1.5 px-3 font-semibold text-accent hover:underline">
                    Back to today
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </Reveal>

      {/* Sources */}
      {lesson.sources.length > 0 && (
        <Reveal className="mt-10">
          <section aria-labelledby="sources">
            <h2 id="sources" className="text-sm font-bold tracking-wider text-muted uppercase">
              Sources &amp; further reading
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-3xl border border-line bg-surface">
              {lesson.sources.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="group inline-flex items-start gap-2 font-semibold hover:text-accent">
                      {s.title}
                      <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="font-semibold">{s.title}</span>
                  )}
                  {s.publisher && <p className="mt-0.5 text-sm text-muted">{s.publisher}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              This is general information, not professional advice.{" "}
              <Link href="/disclaimer" className="underline">
                Content disclaimer
              </Link>
            </p>
          </section>
        </Reveal>
      )}
    </article>
  );
}
