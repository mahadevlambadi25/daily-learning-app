import { ApiError, ok, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/session";
import { getLessonForLearner } from "@/server/lessons";

type Ctx = { params: Promise<{ id: string }> };

/** Published lessons only; drafts and quiz answers are never exposed. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const lesson = await getLessonForLearner(id, user.id);
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found.");
  return ok(lesson);
});
