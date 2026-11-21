import type { LessonAction, LessonStatus } from "./validation";
import { wordCount } from "./lesson-content";

export const STATUS_LABELS: Record<LessonStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/** Which editorial actions are allowed from each status, and where they lead (PRD §11). */
const ACTIONS: Record<LessonStatus, Partial<Record<LessonAction, LessonStatus>>> = {
  draft: { submit: "in_review", archive: "archived" },
  in_review: { approve_publish: "published", approve_schedule: "scheduled", return_to_draft: "draft" },
  scheduled: { reschedule: "scheduled", cancel_schedule: "draft" },
  published: { unpublish: "draft", archive: "archived" },
  archived: { restore: "draft" },
};

export function allowedActions(status: string): LessonAction[] {
  return Object.keys(ACTIONS[status as LessonStatus] ?? {}) as LessonAction[];
}

/** Target status for `action` from `status`, or null if the transition is not allowed. */
export function nextStatus(status: string, action: LessonAction): LessonStatus | null {
  return ACTIONS[status as LessonStatus]?.[action] ?? null;
}

/** Actions that require the lesson to pass the full publish checklist. */
export const ACTIONS_REQUIRING_COMPLETE = new Set<LessonAction>(["submit", "approve_publish", "approve_schedule", "reschedule"]);

export const ACTION_LABELS: Record<LessonAction, string> = {
  submit: "Submit for review",
  approve_publish: "Approve & publish now",
  approve_schedule: "Approve & schedule",
  return_to_draft: "Return to draft",
  reschedule: "Reschedule",
  cancel_schedule: "Cancel schedule",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore to draft",
};

export type PublishCheckLesson = {
  topicId?: string | null;
  title: string;
  hook: string;
  body: string;
  takeaway1: string;
  takeaway2: string;
  takeaway3: string;
  actionText: string;
  rightsBasis: string | null;
  requiresSources: boolean;
  sourcesCount: number;
};

/**
 * Returns blocking `errors` (submit/publish/schedule refused) and non-blocking `warnings`.
 * Required before publish: all content fields, rights basis, and sources for factual content.
 */
export function publishIssues(l: PublishCheckLesson): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!l.topicId) errors.push("A primary topic is required.");
  if (!l.title.trim()) errors.push("Title is required.");
  if (!l.hook.trim()) errors.push("Hook is required.");
  if (!l.body.trim()) errors.push("Body is required.");
  if (![l.takeaway1, l.takeaway2, l.takeaway3].every((t) => t.trim())) errors.push("Exactly 3 key takeaways are required.");
  if (!l.actionText.trim()) errors.push("A practical action is required.");
  if (!l.rightsBasis) errors.push("Rights basis is missing. It is required before publishing.");
  if (l.requiresSources && l.sourcesCount === 0) errors.push("Sources are missing. Factual lessons need at least one source.");
  const wc = wordCount(l.body);
  if (l.body.trim() && (wc < 150 || wc > 250)) warnings.push(`Body is ${wc} words; the editorial target is 150-250.`);
  return { errors, warnings };
}
