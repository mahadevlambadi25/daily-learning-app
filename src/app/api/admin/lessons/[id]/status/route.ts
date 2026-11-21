import { ok, parseJson, route } from "@/lib/api";
import { lessonActionSchema } from "@/lib/validation";
import { requireApiAdmin } from "@/lib/auth/session";
import { applyLessonAction } from "@/server/admin-lessons";

type Ctx = { params: Promise<{ id: string }> };

/** Any editorial transition: submit, return to draft, unpublish, archive, restore, ... */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const { action, scheduledAt } = await parseJson(req, lessonActionSchema);
  const lesson = await applyLessonAction(id, action, admin.id, scheduledAt);
  return ok({ id: lesson.id, status: lesson.status, publishedAt: lesson.publishedAt, scheduledAt: lesson.scheduledAt });
});
