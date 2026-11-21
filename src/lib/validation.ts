import { z } from "zod";
import { DELIVERY_TIMES, MAX_TOPICS, MIN_TOPICS } from "./config";
import { isValidTimezone } from "./time";

export const LESSON_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const RIGHTS_BASES = ["original", "public_domain", "licensed", "other_reviewed"] as const;
export type RightsBasis = (typeof RIGHTS_BASES)[number];

export const RIGHTS_LABELS: Record<RightsBasis, string> = {
  original: "Original writing",
  public_domain: "Public domain (edition verified)",
  licensed: "Licensed",
  other_reviewed: "Other reviewed basis",
};

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const signupSchema = z.object({
  email,
  password,
  displayName: z.string().trim().max(60).optional().or(z.literal("")),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the Terms and Privacy Policy" }) }),
});

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password });

export const timezoneSchema = z.string().refine(isValidTimezone, "Unknown timezone");
export const deliveryTimeSchema = z.enum(DELIVERY_TIMES);

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().max(60).nullable(),
    timezone: timezoneSchema,
    preferredDeliveryTime: deliveryTimeSchema,
    emailDailyEnabled: z.boolean(),
    reminderEnabled: z.boolean(),
    completeOnboarding: z.boolean(),
  })
  .partial()
  .strict();

export const topicSelectionSchema = z.object({
  topicIds: z
    .array(z.string().min(1).max(64))
    .min(MIN_TOPICS, `Choose at least ${MIN_TOPICS} topic`)
    .max(MAX_TOPICS, `Choose up to ${MAX_TOPICS} topics`)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate topics"),
});

export const progressSchema = z.object({ status: z.enum(["started", "completed"]) });

export const quizSubmitSchema = z.object({
  answers: z.record(z.string(), z.enum(["a", "b", "c", "d"])),
});

// ---- Admin lesson editing -------------------------------------------------

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Must be an http(s) URL")
  .optional()
  .nullable();

export const sourceInputSchema = z.object({
  sourceTitle: z.string().trim().min(1, "Source title is required").max(300),
  sourceUrl: optionalUrl,
  authorOrPublisher: z.string().trim().max(200).optional().nullable(),
  accessedAt: z.string().trim().max(30).optional().nullable(),
  rightsBasis: z.enum(RIGHTS_BASES).optional().nullable(),
  reviewerNote: z.string().trim().max(1000).optional().nullable(),
});
export type SourceInput = z.infer<typeof sourceInputSchema>;

export const questionInputSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  optionA: z.string().trim().min(1, "Option A is required").max(200),
  optionB: z.string().trim().min(1, "Option B is required").max(200),
  optionC: z.string().trim().min(1, "Option C is required").max(200),
  optionD: z.string().trim().min(1, "Option D is required").max(200),
  correctOption: z.enum(["a", "b", "c", "d"]),
  explanation: z.string().trim().min(1, "Explanation is required").max(500),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

/**
 * Drafts may be incomplete (PRD §11), so only topic + title are required to save.
 * Field length limits are always enforced; completeness is checked by `publishIssues`.
 */
export const lessonInputSchema = z.object({
  topicId: z.string().min(1, "Choose a topic"),
  title: z.string().trim().min(1, "Title is required").max(90, "Title max 90 characters"),
  hook: z.string().trim().max(300, "Hook max 300 characters").default(""),
  body: z.string().trim().max(5000, "Body is too long").default(""),
  takeaways: z
    .array(z.string().trim().max(160, "Each takeaway max 160 characters"))
    .length(3)
    .default(["", "", ""]),
  actionText: z.string().trim().max(500, "Practical action max 500 characters").default(""),
  readTimeMinutes: z.number().int().min(1).max(30).nullable().optional(),
  tags: z.string().trim().max(200).default(""),
  editorNotes: z.string().trim().max(2000, "Editor notes max 2000 characters").default(""),
  rightsBasis: z.enum(RIGHTS_BASES).nullable().optional(),
  requiresSources: z.boolean().default(true),
  isRepeatable: z.boolean().default(false),
  sources: z.array(sourceInputSchema).max(10).default([]),
  questions: z.array(questionInputSchema).max(3, "Max 3 questions").default([]),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

export const LESSON_ACTIONS = [
  "submit",
  "approve_publish",
  "approve_schedule",
  "return_to_draft",
  "reschedule",
  "cancel_schedule",
  "unpublish",
  "archive",
  "restore",
] as const;
export type LessonAction = (typeof LESSON_ACTIONS)[number];

export const lessonActionSchema = z.object({
  action: z.enum(LESSON_ACTIONS),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export const scheduleSchema = z.object({ scheduledAt: z.string().datetime({ offset: true }) });

export const ANALYTICS_EVENTS = [
  "signup_completed",
  "onboarding_topics_saved",
  "daily_feed_viewed",
  "lesson_opened",
  "lesson_listen_started",
  "lesson_bookmarked",
  "lesson_completed",
  "daily_email_sent",
  "daily_email_failed",
  "topic_selection_changed",
  "quiz_submitted",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Client-reportable events (others are recorded server-side so metrics stay trustworthy). */
export const clientEventSchema = z.object({
  name: z.enum(["lesson_listen_started"]),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const aiDraftRequestSchema = z.object({
  topicId: z.string().min(1, "Choose a topic"),
  objective: z.string().trim().min(10, "Describe the learning objective (at least 10 characters)").max(300),
  sourceNotes: z.string().trim().max(4000, "Source notes max 4000 characters").default(""),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

/** Flattens a ZodError into { field: message } for forms. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
