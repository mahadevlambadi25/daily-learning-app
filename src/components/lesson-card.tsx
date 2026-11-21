import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Headphones } from "lucide-react";
import { TopicIcon } from "./topic-icon";
import { BookmarkButton } from "./bookmark-button";
import { Badge, cn } from "./ui";

export type LessonCardData = {
  lesson: {
    id: string;
    title: string;
    hook: string;
    readTimeMinutes: number;
    topic: { name: string; iconKey: string; slug: string };
  };
  completed: boolean;
  bookmarked: boolean;
};

export function LessonCard({
  item,
  featured = false,
  onBookmarkChange,
}: {
  item: LessonCardData;
  featured?: boolean;
  onBookmarkChange?: (bookmarked: boolean) => void;
}) {
  const { lesson, completed, bookmarked } = item;
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-3xl border border-line bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        completed && "bg-surface/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-accent uppercase">
          <span className="grid size-8 place-items-center rounded-xl bg-accent-soft">
            <TopicIcon iconKey={lesson.topic.iconKey} className="size-4" />
          </span>
          {lesson.topic.name}
        </span>
        <div className="relative z-10 -mt-1 -mr-2">
          <BookmarkButton lessonId={lesson.id} initial={bookmarked} onChange={onBookmarkChange} />
        </div>
      </div>

      <h3 className={cn("mt-4 font-display font-semibold leading-snug text-balance", featured ? "text-2xl sm:text-3xl" : "text-xl")}>
        {/* Stretched link: the whole card is clickable, buttons stay independent */}
        <Link href={`/lessons/${lesson.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus)] focus-visible:outline-none">
          {lesson.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 leading-relaxed text-muted">{lesson.hook}</p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Clock className="size-4" aria-hidden />
          {lesson.readTimeMinutes} min read
          {completed && (
            <Badge tone="success">
              <CheckCircle2 className="size-3.5" aria-hidden /> Done
            </Badge>
          )}
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <Link
            href={`/lessons/${lesson.id}?mode=listen`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold transition-colors hover:bg-surface-2"
            aria-label={`Listen to ${lesson.title}`}
          >
            <Headphones className="size-4" aria-hidden /> Listen
          </Link>
          <Link
            href={`/lessons/${lesson.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-bg transition-transform hover:scale-[1.03]"
            aria-label={`Read ${lesson.title}`}
          >
            <BookOpen className="size-4" aria-hidden /> Read
          </Link>
        </div>
      </div>
    </article>
  );
}
