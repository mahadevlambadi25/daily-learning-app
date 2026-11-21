import { STATUS_LABELS } from "@/lib/lesson-workflow";
import type { LessonStatus } from "@/lib/validation";
import { cn } from "../ui";

const TONES: Record<LessonStatus, string> = {
  draft: "bg-surface-2 text-muted",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  published: "bg-success-soft text-success",
  archived: "bg-surface-2 text-muted line-through",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as LessonStatus;
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", TONES[s] ?? TONES.draft)}>{STATUS_LABELS[s] ?? status}</span>;
}
