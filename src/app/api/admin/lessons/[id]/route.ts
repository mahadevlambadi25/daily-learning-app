import { ApiError, noContent, ok, parseJson, route } from "@/lib/api";
import { lessonInputSchema } from "@/lib/validation";
import { requireApiAdmin } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { publishIssues } from "@/lib/lesson-workflow";
import { deleteLesson, getLessonForEdit, updateLesson } from "@/server/admin-lessons";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  const lesson = await getLessonForEdit(id);
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found.");
  return ok(lesson, { meta: publishIssues({ ...lesson, sourcesCount: lesson.sources.length }) });
});

/** Updates content fields. Status changes go through /publish, /schedule and /status. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(req, "admin-write", 60, 60_000, admin.id);
  const { id } = await params;
  const input = await parseJson(req, lessonInputSchema);
  const lesson = await updateLesson(id, input, admin.id);
  return ok({ id: lesson.id, status: lesson.status, readTimeMinutes: lesson.readTimeMinutes });
});

/** Deletes a never-delivered draft/archived lesson; otherwise 409 (archive instead). */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(req, "admin-write", 60, 60_000, admin.id);
  const { id } = await params;
  await deleteLesson(id, admin.id);
  return noContent();
});
