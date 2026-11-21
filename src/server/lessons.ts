import { prisma, isUniqueViolation } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { addDays, localDate, safeTimezone } from "@/lib/time";
import { track } from "./analytics";

export const PUBLISHED = { status: "published" } as const;

async function assertPublished(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, ...PUBLISHED }, select: { id: true, topicId: true } });
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found.");
  return lesson;
}

/** Full lesson for the learner view. Drafts are never exposed; quiz answers stay server-side. */
export async function getLessonForLearner(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, ...PUBLISHED },
    include: {
      topic: { select: { id: true, name: true, slug: true, iconKey: true } },
      sources: { orderBy: { createdAt: "asc" } },
      questions: { orderBy: { displayOrder: "asc" } },
      progress: { where: { userId } },
      bookmarks: { where: { userId }, select: { id: true } },
    },
  });
  if (!lesson) return null;
  return toLearnerLesson(lesson, {
    completed: lesson.progress[0]?.status === "completed",
    bookmarked: lesson.bookmarks.length > 0,
  });
}

type LessonWithRelations = NonNullable<Awaited<ReturnType<typeof loadForPreview>>>;

/** Admin preview loads any status; used by the preview page. */
export function loadForPreview(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      topic: { select: { id: true, name: true, slug: true, iconKey: true } },
      sources: { orderBy: { createdAt: "asc" } },
      questions: { orderBy: { displayOrder: "asc" } },
    },
  });
}

export function toLearnerLesson(
  l: Omit<LessonWithRelations, never>,
  state: { completed: boolean; bookmarked: boolean },
) {
  return {
    id: l.id,
    title: l.title,
    hook: l.hook,
    body: l.body,
    takeaways: [l.takeaway1, l.takeaway2, l.takeaway3].filter(Boolean),
    actionText: l.actionText,
    readTimeMinutes: l.readTimeMinutes,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    topic: l.topic,
    sources: l.sources.map((s) => ({
      id: s.id,
      title: s.sourceTitle,
      url: s.sourceUrl,
      publisher: s.authorOrPublisher,
    })),
    questions: l.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD },
    })),
    ...state,
  };
}
export type LearnerLesson = ReturnType<typeof toLearnerLesson>;

// ---- Progress -----------------------------------------------------------------

export async function setProgress(userId: string, lessonId: string, status: "started" | "completed") {
  await assertPublished(lessonId);
  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });

  if (status === "started") {
    if (existing) return existing; // never downgrade a completion
    try {
      return await prisma.lessonProgress.create({ data: { userId, lessonId, status: "started" } });
    } catch (err) {
      if (isUniqueViolation(err)) return prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
      throw err;
    }
  }

  if (existing?.status === "completed") return existing; // idempotent
  const now = new Date();
  const row = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "completed", startedAt: now, completedAt: now },
    update: { status: "completed", completedAt: now },
  });
  await track("lesson_completed", userId, { lessonId });
  return row;
}

/** Marks a lesson as completed=false (undo), keeping it as started. */
export async function undoCompletion(userId: string, lessonId: string) {
  await prisma.lessonProgress.updateMany({
    where: { userId, lessonId, status: "completed" },
    data: { status: "started", completedAt: null },
  });
}

// ---- Bookmarks ----------------------------------------------------------------

export async function addBookmark(userId: string, lessonId: string): Promise<{ created: boolean }> {
  await assertPublished(lessonId);
  try {
    await prisma.bookmark.create({ data: { userId, lessonId } });
    await track("lesson_bookmarked", userId, { lessonId });
    return { created: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false }; // idempotent
    throw err;
  }
}

/** Scoped to the caller's own bookmark; deleting a missing bookmark is a no-op. */
export async function removeBookmark(userId: string, lessonId: string): Promise<void> {
  await prisma.bookmark.deleteMany({ where: { userId, lessonId } });
}

// ---- Library ------------------------------------------------------------------

export type LibraryFilter = "saved" | "completed";
export const LIBRARY_PAGE_SIZE = 12;

export async function getLibrary(userId: string, filter: LibraryFilter, page = 1, pageSize = LIBRARY_PAGE_SIZE) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const lessonSelect = {
    id: true,
    title: true,
    hook: true,
    readTimeMinutes: true,
    topic: { select: { id: true, name: true, slug: true, iconKey: true } },
    progress: { where: { userId }, select: { status: true } },
    bookmarks: { where: { userId }, select: { id: true } },
  } as const;

  const rows =
    filter === "saved"
      ? (
          await prisma.bookmark.findMany({
            where: { userId, lesson: PUBLISHED },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip,
            take: pageSize + 1,
            select: { createdAt: true, lesson: { select: lessonSelect } },
          })
        ).map((b) => ({ at: b.createdAt, lesson: b.lesson }))
      : (
          await prisma.lessonProgress.findMany({
            where: { userId, status: "completed", lesson: PUBLISHED },
            orderBy: [{ completedAt: "desc" }, { id: "desc" }],
            skip,
            take: pageSize + 1,
            select: { completedAt: true, lesson: { select: lessonSelect } },
          })
        ).map((p) => ({ at: p.completedAt!, lesson: p.lesson }));

  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize).map(({ at, lesson }) => ({
    at: at.toISOString(),
    lesson: {
      id: lesson.id,
      title: lesson.title,
      hook: lesson.hook,
      readTimeMinutes: lesson.readTimeMinutes,
      topic: lesson.topic,
    },
    completed: lesson.progress[0]?.status === "completed",
    bookmarked: lesson.bookmarks.length > 0,
  }));
  return { items, page, hasMore };
}

// ---- Quiz ---------------------------------------------------------------------

export async function submitQuiz(userId: string, lessonId: string, answers: Record<string, "a" | "b" | "c" | "d">) {
  await assertPublished(lessonId);
  const questions = await prisma.lessonQuestion.findMany({ where: { lessonId }, orderBy: { displayOrder: "asc" } });
  if (!questions.length) throw new ApiError(404, "not_found", "This lesson has no knowledge check.");
  const results = questions.map((q) => ({
    questionId: q.id,
    selected: answers[q.id] ?? null,
    correctOption: q.correctOption,
    isCorrect: answers[q.id] === q.correctOption,
    explanation: q.explanation,
  }));
  const score = results.filter((r) => r.isCorrect).length;
  await prisma.quizAttempt.create({
    data: { userId, lessonId, score, total: questions.length, answersJson: JSON.stringify(answers) },
  });
  await track("quiz_submitted", userId, { lessonId, score, total: questions.length });
  return { score, total: questions.length, results };
}

// ---- Stats --------------------------------------------------------------------

/**
 * Current streak = consecutive local days (user's timezone) with at least one completion,
 * ending today, or yesterday if nothing is completed yet today.
 */
export function computeStreak(completionDates: Date[], timezone: string, now: Date = new Date()): number {
  const tz = safeTimezone(timezone);
  const days = new Set(completionDates.map((d) => localDate(tz, d)));
  const today = localDate(tz, now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getLearningStats(userId: string, timezone: string, now: Date = new Date()) {
  // Only the last ~400 days can affect the streak; bounds the query.
  const since = new Date(now.getTime() - 400 * 86_400_000);
  const [completed, recent, saved] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, status: "completed" } }),
    prisma.lessonProgress.findMany({
      where: { userId, status: "completed", completedAt: { gte: since } },
      select: { completedAt: true },
    }),
    prisma.bookmark.count({ where: { userId } }),
  ]);
  const streak = computeStreak(recent.map((r) => r.completedAt!).filter(Boolean), timezone, now);
  return { completed, streak, saved };
}
