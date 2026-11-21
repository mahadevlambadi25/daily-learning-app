import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { estimateReadTime } from "@/lib/lesson-content";
import { ACTIONS_REQUIRING_COMPLETE, nextStatus, publishIssues } from "@/lib/lesson-workflow";
import { LESSON_STATUSES, type LessonAction, type LessonInput } from "@/lib/validation";

export const ADMIN_PAGE_SIZE = 20;

export type AdminLessonFilters = {
  q?: string;
  topicId?: string;
  status?: string;
  scheduledDate?: string; // YYYY-MM-DD (UTC day)
  page?: number;
};

export async function listLessons(f: AdminLessonFilters) {
  const where: Prisma.LessonWhereInput = {};
  if (f.q?.trim()) where.title = { contains: f.q.trim() };
  if (f.topicId) where.topicId = f.topicId;
  if (f.status && (LESSON_STATUSES as readonly string[]).includes(f.status)) where.status = f.status;
  if (f.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(f.scheduledDate)) {
    const start = new Date(`${f.scheduledDate}T00:00:00.000Z`);
    where.scheduledAt = { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }
  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([
    prisma.lesson.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        rightsBasis: true,
        requiresSources: true,
        readTimeMinutes: true,
        publishedAt: true,
        scheduledAt: true,
        updatedAt: true,
        topic: { select: { id: true, name: true } },
        _count: { select: { sources: true } },
      },
    }),
    prisma.lesson.count({ where }),
  ]);
  return {
    items: items.map((l) => ({
      ...l,
      warnings: [
        ...(!l.rightsBasis ? ["Rights basis missing"] : []),
        ...(l.requiresSources && l._count.sources === 0 ? ["Sources missing"] : []),
      ],
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export function getLessonForEdit(id: string) {
  return prisma.lesson.findUnique({
    where: { id },
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      questions: { orderBy: { displayOrder: "asc" } },
      topic: { select: { id: true, name: true } },
    },
  });
}

function toLessonData(input: LessonInput) {
  const [t1, t2, t3] = input.takeaways;
  const readTimeOverride = input.readTimeMinutes != null;
  return {
    topicId: input.topicId,
    title: input.title,
    hook: input.hook,
    body: input.body,
    takeaway1: t1,
    takeaway2: t2,
    takeaway3: t3,
    actionText: input.actionText,
    readTimeOverride,
    readTimeMinutes: readTimeOverride
      ? input.readTimeMinutes!
      : estimateReadTime(input.hook, input.body, t1, t2, t3, input.actionText),
    tags: input.tags,
    editorNotes: input.editorNotes,
    rightsBasis: input.rightsBasis ?? null,
    requiresSources: input.requiresSources,
    isRepeatable: input.isRepeatable,
  };
}

function childRows(input: LessonInput) {
  return {
    sources: input.sources.map((s) => ({
      sourceTitle: s.sourceTitle,
      sourceUrl: s.sourceUrl || null,
      authorOrPublisher: s.authorOrPublisher || null,
      accessedAt: s.accessedAt ? new Date(s.accessedAt) : null,
      rightsBasis: s.rightsBasis ?? null,
      reviewerNote: s.reviewerNote || null,
    })),
    questions: input.questions.map((q, i) => ({ ...q, displayOrder: i })),
  };
}

async function assertActiveTopic(topicId: string) {
  const topic = await prisma.topic.findFirst({ where: { id: topicId, isActive: true } });
  if (!topic) throw new ApiError(400, "validation_error", "Choose an active topic.", { topicId: "Choose an active topic." });
}

function issuesFor(input: LessonInput) {
  const d = toLessonData(input);
  return publishIssues({ ...d, sourcesCount: input.sources.length });
}

export async function createLesson(input: LessonInput, actorId: string) {
  await assertActiveTopic(input.topicId);
  const { sources, questions } = childRows(input);
  const lesson = await prisma.lesson.create({
    data: {
      ...toLessonData(input),
      status: "draft",
      createdBy: actorId,
      updatedBy: actorId,
      sources: { create: sources },
      questions: { create: questions },
    },
  });
  await audit(actorId, "create", lesson.id, { title: lesson.title });
  return lesson;
}

export async function updateLesson(id: string, input: LessonInput, actorId: string) {
  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "not_found", "Lesson not found.");
  if (existing.status === "archived") throw new ApiError(409, "invalid_state", "Restore this lesson to draft before editing.");
  await assertActiveTopic(input.topicId);

  // Lessons past draft must stay publishable after edits.
  if (existing.status !== "draft") {
    const { errors } = issuesFor(input);
    if (errors.length) throw new ApiError(400, "incomplete_lesson", errors[0], { _: errors.join(" ") });
  }

  const { sources, questions } = childRows(input);
  const lesson = await prisma.$transaction(async (tx) => {
    await tx.lessonSource.deleteMany({ where: { lessonId: id } });
    await tx.lessonQuestion.deleteMany({ where: { lessonId: id } });
    return tx.lesson.update({
      where: { id },
      data: {
        ...toLessonData(input),
        updatedBy: actorId,
        sources: { create: sources },
        questions: { create: questions },
      },
    });
  });
  await audit(actorId, "update", id, { status: lesson.status });
  return lesson;
}

/** Applies an editorial status action with transition + content validation (PRD §11). */
export async function applyLessonAction(id: string, action: LessonAction, actorId: string, scheduledAtIso?: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { _count: { select: { sources: true } } } });
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found.");

  const to = nextStatus(lesson.status, action);
  if (!to) throw new ApiError(409, "invalid_transition", `Cannot ${action.replace(/_/g, " ")} a lesson that is ${lesson.status.replace("_", " ")}.`);

  if (ACTIONS_REQUIRING_COMPLETE.has(action)) {
    const { errors } = publishIssues({ ...lesson, sourcesCount: lesson._count.sources });
    if (errors.length) throw new ApiError(400, "incomplete_lesson", errors[0], { _: errors.join(" ") });
  }

  const now = new Date();
  const data: Prisma.LessonUpdateInput = { status: to, updatedBy: actorId };

  if (action === "approve_schedule" || action === "reschedule") {
    const at = scheduledAtIso ? new Date(scheduledAtIso) : null;
    if (!at || Number.isNaN(at.getTime()) || at <= now) {
      throw new ApiError(400, "validation_error", "Choose a future publish time.", { scheduledAt: "Must be in the future." });
    }
    data.scheduledAt = at;
  }
  if (action === "approve_publish" || action === "approve_schedule") {
    data.approvedAt = now;
    data.approvedBy = actorId;
  }
  if (action === "approve_publish") {
    data.publishedAt = now;
    data.scheduledAt = null;
  }
  if (action === "cancel_schedule") data.scheduledAt = null;
  if (action === "unpublish" || action === "restore" || action === "return_to_draft") {
    data.approvedAt = null;
    data.approvedBy = null;
  }

  // Conditional on the status we validated against, so concurrent edits can't skip a step.
  const res = await prisma.lesson.updateMany({ where: { id, status: lesson.status }, data: data as Prisma.LessonUpdateManyMutationInput });
  if (!res.count) throw new ApiError(409, "conflict", "This lesson was changed by someone else. Reload and try again.");
  await audit(actorId, action, id, { from: lesson.status, to, scheduledAt: scheduledAtIso ?? null });
  return prisma.lesson.findUniqueOrThrow({ where: { id } });
}

/**
 * Permanently deletes a Draft/Archived lesson that no learner has ever received, opened,
 * saved or attempted. Lessons with learner history must be archived instead (PRD §13.1).
 */
export async function deleteLesson(id: string, actorId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { _count: { select: { deliveries: true, progress: true, bookmarks: true, quizAttempts: true } } },
  });
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found.");
  if (lesson.status !== "draft" && lesson.status !== "archived") {
    throw new ApiError(409, "invalid_state", "Only drafts and archived lessons can be deleted. Unpublish or archive it first.");
  }
  const c = lesson._count;
  if (c.deliveries + c.progress + c.bookmarks + c.quizAttempts > 0) {
    throw new ApiError(409, "has_history", "Learners have already received this lesson, so it can't be deleted. Keep it archived instead.");
  }
  await prisma.lesson.delete({ where: { id } }); // sources and questions cascade
  await audit(actorId, "delete", id, { title: lesson.title });
}

async function audit(actorId: string | null, action: string, lessonId: string, details: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId, action, entityType: "lesson", entityId: lessonId, details: JSON.stringify(details) } });
}

export function getAuditTrail(lessonId: string) {
  return prisma.auditLog.findMany({ where: { entityType: "lesson", entityId: lessonId }, orderBy: { createdAt: "desc" }, take: 20 });
}

/** Published-lesson count per active topic; low counts mean feeds will run dry (PRD §9). */
export async function getContentCoverage() {
  const [topics, counts] = await Promise.all([
    prisma.topic.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, isFeatured: true } }),
    prisma.lesson.groupBy({ by: ["topicId"], where: { status: "published" }, _count: { _all: true } }),
  ]);
  const byTopic = new Map(counts.map((c) => [c.topicId, c._count._all]));
  return topics.map((t) => ({ ...t, published: byTopic.get(t.id) ?? 0 }));
}
